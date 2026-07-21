import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "MemeBlockbuster — Your Meme, The Movie",
  description: "Turn any meme or idea into a full cinematic movie trailer, in minutes.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-grain min-h-screen">{children}</body>
    </html>
  );
}
