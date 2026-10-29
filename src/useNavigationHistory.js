import { useEffect, useRef } from "react";
import { patrols } from "./model.js";
const sections = [
  "overview",
  "treasury",
  "secretary",
  "progress",
  "photographer",
  "codes",
];
export default function useNavigationHistory(patrol, section, restore) {
  const handler = useRef(restore),
    current = useRef({ patrol, section }),
    initialized = useRef(false),
    restoring = useRef(false);
  handler.current = restore;
  current.current = { patrol, section };
  useEffect(() => {
    const pop = ({ state }) => {
      const route = state?.nexusNavigation;
      if (
        !route ||
        (route.patrol !== null && !patrols.includes(route.patrol)) ||
        !sections.includes(route.section)
      )
        return;
      if (
        route.patrol === current.current.patrol &&
        route.section === current.current.section
      )
        return;
      restoring.current = true;
      handler.current(route);
    };
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, []);
  useEffect(() => {
    if (restoring.current) {
      restoring.current = false;
      return;
    }
    const state = {
      ...window.history.state,
      nexusNavigation: { patrol, section },
    };
    if (!initialized.current) {
      initialized.current = true;
      window.history.replaceState(state, "");
    } else window.history.pushState(state, "");
  }, [patrol, section]);
}
