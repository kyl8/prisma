import Busboy from "busboy"

import { ValidationError } from "../domain/shared/errors.js"

export function readMultipartUpload(request, { maxUploadSize }) {
  return new Promise((resolve, reject) => {
    let parser
    try {
      parser = Busboy({
        headers: request.headers,
        limits: { files: 1, fileSize: maxUploadSize, fields: 20, parts: 21 },
      })
    } catch {
      reject(new ValidationError("Request must be multipart/form-data"))
      return
    }

    const fields = {}
    let upload = null
    let settled = false
    const fail = (error) => {
      if (settled) return
      settled = true
      reject(error)
    }

    parser.on("field", (name, value) => {
      fields[name] = value
    })
    parser.on("file", (name, stream, info) => {
      if (name !== "file" || upload) {
        stream.resume()
        fail(new ValidationError("Multipart request must contain one file field"))
        return
      }
      const chunks = []
      let truncated = false
      stream.on("limit", () => {
        truncated = true
      })
      stream.on("data", (chunk) => chunks.push(chunk))
      stream.on("end", () => {
        if (truncated) {
          fail(
            new ValidationError(
              `Upload exceeds configured limit of ${maxUploadSize} bytes`,
            ),
          )
          return
        }
        upload = {
          buffer: Buffer.concat(chunks),
          fileName: info.filename,
          mimeType: info.mimeType,
        }
      })
    })
    parser.on("filesLimit", () => fail(new ValidationError("Only one file is allowed")))
    parser.on("partsLimit", () => fail(new ValidationError("Multipart request has too many parts")))
    parser.on("error", () => fail(new ValidationError("Malformed multipart request")))
    parser.on("close", () => {
      if (settled) return
      if (!upload) {
        fail(new ValidationError("Multipart request requires a file field"))
        return
      }
      settled = true
      resolve({ ...upload, fields })
    })
    request.pipe(parser)
  })
}
