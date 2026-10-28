function element(tag, text, style = {}) {
  const n = document.createElement(tag);
  if (text !== undefined) n.textContent = text;
  Object.assign(n.style, style);
  return n;
}
function chunks(text) {
  const result = [];
  let part = "",
    lines = 0;
  for (const token of String(text).split(/(\n|\s+)/)) {
    const pieces = token.length > 900 ? token.match(/[\s\S]{1,900}/g) : [token];
    for (const piece of pieces) {
      if (part && (part.length + piece.length > 1000 || lines >= 10)) {
        result.push(part);
        part = "";
        lines = 0;
      }
      part += piece;
      if (piece.includes("\n")) lines++;
    }
  }
  if (part.trim()) result.push(part);
  return result;
}
async function photo(src, style = {}) {
  if (
    !/^data:image\/(png|jpeg|webp);base64,/.test(src) &&
    !/^\/.netlify\/functions\/badge-images\?badge=\d{1,2}&version=[a-f0-9]{64}$/.test(
      src,
    ) &&
    src !== "/icons/orion-green-192.png"
  )
    throw Error("Cette photo ne peut pas être exportée.");
  const img = document.createElement("img");
  Object.assign(img.style, {
    display: "block",
    maxWidth: "100%",
    objectFit: "contain",
    ...style,
  });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () =>
        reject(
          Error(
            "Une photo est indisponible. Réessayez avec une connexion réseau.",
          ),
        ),
      12000,
    );
    img.onload = () => {
      clearTimeout(timeout);
      resolve();
    };
    img.onerror = () => {
      clearTimeout(timeout);
      reject(Error("Impossible de charger une des photos sélectionnées."));
    };
    img.src = src;
  });
  return img;
}
export async function badgeMemoryPdf({
  title,
  member,
  patrol,
  entries,
  cover,
  completed,
  completionDate,
  includeText = true,
  includeCover = true,
  selectedPhotos = [],
}) {
  const [{ jsPDF }, { default: html2canvas }] = await Promise.all([
    import("jspdf"),
    import("html2canvas"),
  ]);
  await document.fonts.ready;
  const host = element("div", undefined, {
    position: "fixed",
    left: "-12000px",
    top: "0",
    width: "794px",
    zIndex: "-1",
    pointerEvents: "none",
  });
  document.body.append(host);
  const pages = [];
  let body;
  async function page(first = false) {
    const sheet = element("article", undefined, {
      position: "relative",
      width: "794px",
      height: "1123px",
      boxSizing: "border-box",
      padding: "0 0 65px",
      background: "#faf8ef",
      color: "#244330",
      fontFamily: '"DM Sans Variable",Arial,sans-serif',
      fontSize: "16px",
      lineHeight: "1.6",
      overflow: "hidden",
    });
    host.append(sheet);
    pages.push(sheet);
    const header = element("div", undefined, {
      padding: first ? "35px 42px" : "22px 42px",
      background: "linear-gradient(120deg,#102f20,#285331)",
      color: "#f6f8e8",
      display: "flex",
      gap: "25px",
      alignItems: "center",
      justifyContent: "space-between",
    });
    sheet.append(header);
    const words = element("div", undefined, { flex: "1", minWidth: "0" });
    header.append(words);
    words.append(
      element("div", "NEXUS · TROUPE ORION", {
        fontSize: "11px",
        letterSpacing: "3px",
        color: "#c0dba1",
        fontWeight: "700",
      }),
    );
    words.append(
      element(
        "div",
        first ? "UN BADGE. UNE AVENTURE." : "MON CARNET DE BADGE",
        {
          fontSize: first ? "12px" : "10px",
          letterSpacing: "2px",
          color: "#c4d1ae",
          margin: "14px 0 7px",
        },
      ),
    );
    words.append(
      element("h1", title, {
        fontFamily: '"Manrope Variable",Arial,sans-serif',
        fontSize: first ? "34px" : "23px",
        fontWeight: "750",
        lineHeight: "1.25",
        margin: "0 0 14px",
        color: "#ffffff",
        overflowWrap: "anywhere",
      }),
    );
    words.append(
      element("span", completed ? "✓ TERMINÉ" : "EN PROGRESSION", {
        display: "inline-block",
        fontSize: "10px",
        letterSpacing: "1.5px",
        padding: "6px 11px",
        background: "#ccdda5",
        color: "#1d3e27",
        borderRadius: "20px",
        fontWeight: "700",
      }),
    );
    if (first) {
      const visual = element("div", undefined, {
        width: "132px",
        height: "132px",
        borderRadius: "50%",
        border: "1px solid #a8c47b",
        background: "#ffffff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "14px",
        boxSizing: "border-box",
        flexShrink: "0",
      });
      visual.append(
        await photo(
          includeCover && cover ? cover : "/icons/orion-green-192.png",
          { maxHeight: "104px", maxWidth: "104px" },
        ),
      );
      header.append(visual);
    }
    body = element("div", undefined, { padding: "28px 42px 0" });
    sheet.append(body);
    if (first) {
      const info = element("div", undefined, {
        padding: "19px 20px",
        background: "#e9eedb",
        borderRadius: "10px",
        marginBottom: "24px",
      });
      info.append(
        element("div", member.name, {
          fontFamily: '"Manrope Variable",Arial,sans-serif',
          fontWeight: "750",
          fontSize: "23px",
          lineHeight: "1.4",
        }),
      );
      info.append(
        element(
          "div",
          `Patrouille ${patrol}${completed && completionDate ? " · Terminé le " + completionDate : ""}`,
          { fontSize: "12px", color: "#617449", marginTop: "6px" },
        ),
      );
      body.append(info);
    }
    const footer = element("div", "", {
      position: "absolute",
      bottom: "21px",
      left: "42px",
      right: "42px",
      fontSize: "10px",
      letterSpacing: "1px",
      borderTop: "1px solid #cbd8ba",
      paddingTop: "11px",
      color: "#748364",
    });
    footer.className = "memory-footer";
    sheet.append(footer);
    return sheet;
  }
  async function add(block) {
    body.append(block);
    if (body.offsetTop + body.scrollHeight > 1052 && body.children.length > 1) {
      block.remove();
      await page(false);
      body.append(block);
    }
    if (body.offsetTop + body.scrollHeight > 1052)
      throw Error(
        "Un contenu est trop long pour cette page. Réduisez sa taille et réessayez.",
      );
  }
  try {
    await page(true);
    if (includeText) {
      for (const entry of entries) {
        for (const [i, text] of chunks(entry.text).entries()) {
          const card = element("section", undefined, {
            borderLeft: "4px solid #99b36b",
            padding: "14px 18px",
            background: "#ffffff",
            borderRadius: "0 9px 9px 0",
            marginBottom: "17px",
          });
          card.append(
            element(
              "div",
              `${i ? "Suite · " : ""}Ma réalisation · ${entry.date}`,
              {
                fontSize: "11px",
                color: "#72865b",
                fontWeight: "700",
                letterSpacing: "1px",
                marginBottom: "9px",
              },
            ),
          );
          card.append(
            element("p", text, {
              fontSize: "15px",
              lineHeight: "1.65",
              whiteSpace: "pre-wrap",
              overflowWrap: "anywhere",
              margin: "0",
              color: "#294831",
            }),
          );
          await add(card);
        }
      }
    }
    for (const item of selectedPhotos) {
      const block = element("figure", undefined, {
        margin: "0 0 20px",
        background: "#ffffff",
        padding: "14px",
        borderRadius: "10px",
        border: "1px solid #dce6cd",
      });
      const image = await photo(item.data, {
        maxHeight: "285px",
        margin: "0 auto",
        width: "auto",
      });
      block.append(image);
      block.append(
        element("figcaption", `Un souvenir de mon parcours · ${item.date}`, {
          fontSize: "11px",
          color: "#71845a",
          paddingTop: "10px",
          textAlign: "center",
        }),
      );
      await add(block);
    }
    if (!entries.length && !selectedPhotos.length)
      await add(
        element("p", "Chaque aventure commence par un premier pas.", {
          fontSize: "19px",
          fontStyle: "italic",
          color: "#798a5f",
          padding: "35px 15px",
          textAlign: "center",
        }),
      );
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: true,
    });
    pdf.setProperties({
      title: `${title} · ${member.name}`,
      subject: `Souvenir de badge · ${patrol}`,
      author: "Nexus · Troupe Orion",
    });
    for (let i = 0; i < pages.length; i++) {
      const content = pages[i].children[1];
      if (content.offsetTop + content.scrollHeight < 850) {
        pages[i].append(
          element("div", "Toujours prêt pour la prochaine aventure.", {
            position: "absolute",
            left: "55px",
            right: "55px",
            bottom: "130px",
            fontFamily: '"Manrope Variable",Arial,sans-serif',
            fontSize: "20px",
            fontWeight: "600",
            fontStyle: "italic",
            color: "#819564",
            textAlign: "center",
            borderTop: "1px solid #cddbb9",
            paddingTop: "25px",
          }),
        );
      }
      pages[i].querySelector(".memory-footer").textContent =
        `NEXUS · TROUPE ORION — MON PARCOURS, MES SOUVENIRS                    ${i + 1} / ${pages.length}`;
      const canvas = await html2canvas(pages[i], {
        scale: 1.6,
        backgroundColor: "#faf8ef",
        logging: false,
        windowWidth: 794,
        windowHeight: 1123,
      });
      if (i) pdf.addPage();
      pdf.addImage(
        canvas.toDataURL("image/jpeg", 0.94),
        "JPEG",
        0,
        0,
        210,
        297,
        undefined,
        "FAST",
      );
    }
    return pdf.output("blob");
  } finally {
    host.remove();
  }
}
