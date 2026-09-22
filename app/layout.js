import "./globals.css";
import Nav from "@/components/Nav";
import { ToastProvider } from "@/components/Toast";
import { getSession } from "@/lib/session";

export const metadata = {
  title: "Individual Student Attendance",
  description: "Track and sign off individual student attendance sheets",
};

export const viewport = { width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }) {
  const session = await getSession();
  const user = session ? { name: session.name, role: session.role } : null;

  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
        <link
          href="https://fonts.googleapis.com/css2?family=Source+Serif+4:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&family=Caveat:wght@500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ToastProvider>
          <Nav user={user} />
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
