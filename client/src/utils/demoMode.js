import { useMemo } from "react";
import { useLocation } from "react-router-dom";

import { isDemoMode } from "./demoModeCore";

export function useDemoMode() {
    const location = useLocation();

    return useMemo(() => isDemoMode(), [location.search]);
}

export { isDemoMode };
