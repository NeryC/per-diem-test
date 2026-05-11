import { getLocations } from "@/lib/square/locations";
import { errorResponse, jsonResponse } from "@/lib/square/responses";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const result = await getLocations();
  if (!result.ok) return errorResponse(result.error);
  return jsonResponse(result.value, { revalidateSeconds: 3600 });
}
