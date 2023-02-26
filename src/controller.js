/** Controller Layer
 * @description
 * Nosso orquestrador.
 * Ex: Recebi uma mensagem do worker, terminei de processar e preciso enviar para view (o worker não conhece a view), então o controlador faz esse papel.
 * Obs: na controller não tem regra de negócio, é só de/para 
 */
export default class Controller {
  #view
  #worker
  #service
  #events = { // padrão de Pattern Matching
    alive: () => { },
    progress: ({ total }) => {
      this.#view.updateProgress(total)
    },
    ocurrenceUpdate: ({ found, linesLength, took }) => {
      const [[key, value]] = Object.entries(found)
      this.#view.updateDebugLog(
        `found ${value} ocurrencies of ${key} - over ${linesLength} lines - took: ${took}`
      )
    }
  }

  constructor({ view, worker, service }) {
    this.#view = view
    this.#service = service
    this.#worker = this.#configureWorker(worker)
  }

  static init(deps) {
    const controller = new Controller(deps)
    controller.init()
    return controller
  }

  
  // Aqui faz o de/para da View -> Controller. E nas funções da Controller -> View
  init() {
    // fazemos a amarração da view com configureOnFileChange. Utilizamos o bind(this) pois se eu quiser usar o this
    // dentro da configureOnFileChange, ele sabe que o this é desta classe, e não da View.
    this.#view.configureOnFileChange(
      this.#configureOnFileChange.bind(this)
    )

    this.#view.configureOnFormSubmit(
      this.#configureOnFormSubmit.bind(this)
    )
  }

  // Aqui faz o De/Para, enviando os possíveis eventos criados em #events para o worker. Assim o worker chama essas funções criadas aqui. Mantendo o Pattern Matching
  #configureWorker(worker) {
    // worker.onmessage é o que vai vir de informação do worker.
    worker.onmessage = ({ data }) => this.#events[data.eventType](data)

    return worker
  }

  #formatBytes(bytes) {
    const units = ['B', 'KB', 'MB', 'GB', 'TB']

    let i = 0

    for (i; bytes >= 1024 && i < 4; i++) {
      bytes /= 1024
    }

    return `${bytes.toFixed(2)} ${units[i]}`
  }

  // executo essa função que vem da view (this.#view)
  #configureOnFileChange(file) {
    this.#view.setFileSize(
      this.#formatBytes(file.size)
    )
  }

  #configureOnFormSubmit({ description, file }) {
    const query = {}
    // 'call description' é a propiedade do CSV que vamos buscar os valores, na qual poderia ser dinâmico no HTML e procurar em outras colunas
    query['call description'] = new RegExp(
      description, 'i' // i -> case insensitive, ou seja, caixa alta ou baixa, irá encontrar o texto
    )

    if (this.#view.isWorkerEnabled()) {
      console.log('executing on worker thread!')
      this.#worker.postMessage({ query, file }) 
      return
    }

    console.log('executing on main thread!')
    this.#service.processFile({
      query,
      file,
      onProgress: (total) => {
        this.#events.progress({ total })
      },
      onOcurrenceUpdate: (...args) => {
        this.#events.ocurrenceUpdate(...args)
      }
    })
  }
}
