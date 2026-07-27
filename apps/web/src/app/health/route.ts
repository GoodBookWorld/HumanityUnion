export async function GET(): Promise<Response> {
  return Response.json({
    status: "healthy",
    service: "Humanity Union Web",
    timestamp: new Date().toISOString(),
  });
}
