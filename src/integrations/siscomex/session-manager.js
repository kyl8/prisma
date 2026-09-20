export class SiscomexSessionManager {
  #session = null
  #authentication = null
  #queue = Promise.resolve()

  constructor({ authProvider, clock = Date.now }) {
    this.authProvider = authProvider
    this.clock = clock
  }

  async getSession({ force = false, signal } = {}) {
    if (!force && this.#isUsable(this.#session)) return { ...this.#session }
    if (!this.#authentication) {
      this.#authentication = this.authProvider
        .authenticate({ signal })
        .then((session) => {
          this.#session = { ...session }
          return { ...session }
        })
        .finally(() => {
          this.#authentication = null
        })
    }
    return this.#authentication
  }

  updateFromResponse(response) {
    if (!this.#session) return
    const authorization = response.headers.get("set-token")
    const csrfToken = response.headers.get("x-csrf-token")
    const rawExpiration = Number(response.headers.get("x-csrf-expiration"))
    this.#session = {
      authorization: authorization ?? this.#session.authorization,
      csrfToken: csrfToken ?? this.#session.csrfToken,
      expiresAt:
        Number.isFinite(rawExpiration) && rawExpiration > this.clock()
          ? rawExpiration
          : this.#session.expiresAt,
    }
  }

  invalidate() {
    this.#session = null
  }

  runExclusive(work) {
    const run = this.#queue.then(work, work)
    this.#queue = run.catch(() => undefined)
    return run
  }

  #isUsable(session) {
    return Boolean(session && session.expiresAt - this.clock() > 5_000)
  }
}
