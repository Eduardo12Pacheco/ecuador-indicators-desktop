import { createHashRouter, Navigate, type RouteObject } from "react-router";
import { DesignGallery } from "../ui/design/primitives/gallery/DesignGallery";
import { AboutPage } from "../ui/features/about/AboutPage";
import { ComparePage } from "../ui/features/compare/ComparePage";
import { ExplorePage } from "../ui/features/explore/ExplorePage";
import { SettingsPage } from "../ui/features/settings/SettingsPage";
import { ViewsPage } from "../ui/features/views/ViewsPage";
import { AppShell } from "./shell/AppShell";

export const DEFAULT_INDICATOR = "NY.GDP.MKTP.CD";

/** Routes from D7; the design gallery exists outside production builds only. */
export function appRoutes(): RouteObject[] {
  const children: RouteObject[] = [
    { index: true, element: <Navigate to={`/explore/${DEFAULT_INDICATOR}`} replace /> },
    { path: "explore", element: <Navigate to={`/explore/${DEFAULT_INDICATOR}`} replace /> },
    { path: "explore/:code", element: <ExplorePage /> },
    { path: "compare", element: <Navigate to="/compare/trajectories" replace /> },
    { path: "compare/trajectories", element: <ComparePage /> },
    { path: "compare/ranking", element: <ComparePage /> },
    { path: "views", element: <ViewsPage /> },
    { path: "settings", element: <SettingsPage /> },
    { path: "about", element: <AboutPage /> },
  ];

  if (import.meta.env.MODE !== "production") {
    children.push({ path: "design", element: <DesignGallery /> });
  }

  return [{ path: "/", element: <AppShell />, children }];
}

/** Creates the hash router used by the application. */
export function createAppRouter() {
  return createHashRouter(appRoutes());
}
