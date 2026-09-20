export async function readSiscomexResponse(response) {
  if (response.status === 204) return null
  const text = await response.text()
  if (!text) return null
  const contentType = response.headers.get("content-type") ?? ""
  if (contentType.includes("json") || /^[\[{]/.test(text.trim())) {
    try {
      return JSON.parse(text)
    } catch {
      return { message: "Siscomex returned invalid JSON" }
    }
  }
  return text
}
