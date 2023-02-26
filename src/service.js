/** Service Layer
 * @description
 * Toda regra de negócio. Está no navegador, porém podemos levar para nodejs etc
 */
export default class Service {

  processFile({ query, file, onOcurrenceUpdate, onProgress }) {
    const linesLength = { counter: 0 }
    const progressFn = this.#setupProgress(file.size, onProgress)

    // Calcular quanto tempo levou
    const startedAt = performance.now()
    const elapsed = () => `${((performance.now() - startedAt) / 1000).toFixed(2)} secs` // divido por 1000 para calcular em segundos, já que me retorna em ms

    // subsituo com o onUpdate
    const onUpdate = () => {
      return (found) => {
        onOcurrenceUpdate({
          found,
          took: elapsed(),
          linesLength: linesLength.counter
        })

      }
    }

    // Lendo o arquivo. stream para leitura dos arquivos (Web stream)
    file.stream()
      .pipeThrough(new TextDecoderStream()) // textDecoder para converter o que está em binário para texto
      .pipeThrough(this.#csvToJSON({ linesLength, progressFn })) // 
      .pipeTo(this.#findOcurrencies({ query, onOcurrenceUpdate: onUpdate() })) // pipeTo é o destino final.
    // .pipeTo(new WritableStream({
    //   write(chunk) {
    // console.log('chunk', chunk)
    //   }
    // }))
  }


  #csvToJSON({ linesLength, progressFn }) {
    let columns = []

    // TransformStream -> let e processar dados sob demanda no navegador
    return new TransformStream({
      transform(chunk, controller) {
        progressFn(chunk.length)
        const lines = chunk.split('\n')
        linesLength.counter += lines.length

        if (!columns.length) {
          const firstLine = lines.shift()
          columns = firstLine.split(',')
          linesLength.counter--
        }

        for (const line of lines) {
          if (!line.length) continue
          let currentItem = {}
          const currentColumsItems = line.split(',')
          for (const columnIndex in currentColumsItems) {
            const columnItem = currentColumsItems[columnIndex]
            currentItem[columns[columnIndex]] = columnItem.trimEnd() // linha inteira do CSV
          }
          controller.enqueue(currentItem)
        }
      }
    })
  }

  #findOcurrencies({ query, onOcurrenceUpdate }) {
    const queryKeys = Object.keys(query) // essa seria a chave 'call description', porém caso quisermos mais chaves, já fica pronto.
    let found = {}

    //
    return new WritableStream({
      write(jsonLine) {
        for (const keyIndex in queryKeys) {
          const key = queryKeys[keyIndex]
          const queryValue = query[key]
          // o found utilizamos para falar "encontramos N condições para pesquisa"
          found[queryValue] = found[queryValue] ?? 0 // iniciamos com 0
          if (queryValue.test(jsonLine[key])) { // Como é uma regex, o .test me retorna true ou false caso encontre referente a string
            found[queryValue]++
            onOcurrenceUpdate(found) // Aqui eu vou mandando dinamicamente para ir atualizando em tela em realTime
          }
        }
      },
      close: () => onOcurrenceUpdate(found) // para ter 100% dos itens, utilizamos o close, para garantir que na finalização, temos o objeto todo
    })
  }
  #setupProgress(totalBytes, onProgress) {
    let totalUploaded = 0
    onProgress(0)

    return (chunkLength) => {
      totalUploaded += chunkLength
      const total = 100 / totalBytes * totalUploaded
      onProgress(total)
    }
  }
}