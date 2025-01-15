import { html } from "hono/html";

interface LayoutProps {
  title: string;
  children: any;
}

export const Layout = ({ title, children }: LayoutProps) => html`
  <!DOCTYPE html>
  <html>
    <head>
      <title>${title} - DB Dashboard</title>
      <script src="https://unpkg.com/htmx.org@1.9.10"></script>
      <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-gray-100">
      <nav class="bg-white shadow-sm">
        <div class="max-w-7xl mx-auto px-4 py-3">
          <div class="flex justify-between">
            <div class="flex space-x-4">
              <a href="/dashboard" class="font-medium">Dashboard</a>
              <a href="/dashboard/schema" class="font-medium">Schema</a>
              <a href="/dashboard/data" class="font-medium">Data</a>
              <a href="/dashboard/permissions" class="font-medium"
                >Permissions</a
              >
            </div>
          </div>
        </div>
      </nav>
      <main class="max-w-7xl mx-auto px-4 py-6">${children}</main>
    </body>
  </html>
`;
