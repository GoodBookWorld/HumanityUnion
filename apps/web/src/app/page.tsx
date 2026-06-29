import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <h1>Humanity Union</h1>
      <p>WORLD SOLIDARITY</p>
      <p>Humanity Union Platform is starting.</p>
      <p>
        <Link href="/member">View Member Profile</Link>
      </p>
    </main>
  );
}
