import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { MotionButton } from "@/components/MotionButton";
import { getKioskLaunch } from "@/lib/kiosk-launch";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-none bg-white px-6 py-2.5 text-sm font-bold uppercase tracking-[0.24em] text-black"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorFallback({ error, reset }: ErrorComponentProps) {
  const err = error instanceof Error ? error : new Error(String(error));
  console.error(err);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(err, { boundary: "tanstack_root_error_component" });
  }, [err]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <MotionButton
            intent="primary"
            onClick={() => {
              router.invalidate();
              reset();
            }}
          >
            Try again
          </MotionButton>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-foreground/20 px-6 py-2.5 text-sm font-medium"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "SEPHORA GAME" },
      { name: "description", content: "A Sephora Collection touchscreen memory game for in-store activations." },
      { name: "author", content: "Lovable" },
      { property: "og:title", content: "SEPHORA GAME" },
      { property: "og:description", content: "A Sephora Collection touchscreen memory game for in-store activations." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "SEPHORA GAME" },
      { name: "twitter:description", content: "A Sephora Collection touchscreen memory game for in-store activations." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/f36a924e-9fc8-49c8-b6a2-8c6f0bb9f656/id-preview-b55f972b--95a15f0e-293c-433a-966e-ecbcfaa83901.lovable.app-1781624291034.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/f36a924e-9fc8-49c8-b6a2-8c6f0bb9f656/id-preview-b55f972b--95a15f0e-293c-433a-966e-ecbcfaa83901.lovable.app-1781624291034.png" },
    ],
    links: [
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Jost:wght@400;500;600;700;800;900&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorFallback,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

/** Sitech: a held finger is the browser's right-click. Only ?kiosk=true refuses it. */
function KioskContextMenuBlock() {
  const searchStr = useRouterState({ select: (s) => s.location.searchStr });
  const kiosk = getKioskLaunch(searchStr).kiosk;
  useEffect(() => {
    if (!kiosk) return;
    const block = (event: Event) => {
      event.preventDefault();
    };
    document.addEventListener("contextmenu", block);
    return () => document.removeEventListener("contextmenu", block);
  }, [kiosk]);
  return null;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <KioskContextMenuBlock />
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
    </QueryClientProvider>
  );
}
