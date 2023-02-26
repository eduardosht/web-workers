/** Worker Layer
 * @description
 * Tudo que for executar em segundo plano. Tudo que pode travar (user muita CPU) utilizamos o worker
 */
import Service from './service.js'
console.log(`Worker on!`)
const service = new Service()

postMessage({ eventType: 'alive' })
onmessage = ({ data }) => { // destruturamos o data do objeto, pois vem várias infos. Só precisamos do data
  const { query, file } = data
  service.processFile({
    query,
    file,
    onOcurrenceUpdate: (args) => {
      postMessage({ eventType: 'ocurrenceUpdate', ...args })
    },
    onProgress: (total) => postMessage({ eventType: 'progress', total })
  })
}