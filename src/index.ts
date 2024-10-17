import express from 'express'
import cors from 'cors'
import multer from 'multer'
import { createHelia } from 'helia'
import { LevelDatastore } from 'datastore-level'
import { LevelBlockstore } from 'blockstore-level'
import { unixfs } from '@helia/unixfs'
import { tcp } from '@libp2p/tcp'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { kadDHT } from '@libp2p/kad-dht'
import { bootstrap } from '@libp2p/bootstrap'
import { ping } from '@libp2p/ping'
import { identify } from '@libp2p/identify'

const upload = multer()
const blockstore = new LevelBlockstore('blockstore')
const datastore = new LevelDatastore('datastore')
let fs: any

const getAlternativePeers = () => {
  return [
    '/ip4/104.131.131.82/tcp/4001/ipfs/QmaCpDMGvV2BGHeYERUEnRQAwe3N8SzbUtfsmvsqQLuvuJ',
    '/ip4/104.236.179.241/tcp/4001/ipfs/QmSoLPppuBtQSGwKDZT2M73ULpjvfd3aZ6ha4oFGL1KrGM',
    '/ip4/128.199.219.111/tcp/4001/ipfs/QmSoLSafTMBsPKadTEgaXctDQVcqN88CNLHXMkTNwMKPnu',
    '/ip4/104.236.76.40/tcp/4001/ipfs/QmSoLV4Bbm51jM9C4gDYZQ9Cy3U6aXMJDAbzgu2fzaDs64',
    '/ip4/178.62.158.247/tcp/4001/ipfs/QmSoLer265NRgSp2LA3dPaeykiS1J6DifTC88f5uVQKNAd',
    '/ip6/2604:a880:1:20::203:d001/tcp/4001/ipfs/QmSoLPppuBtQSGwKDZT2M73ULpjvfd3aZ6ha4oFGL1KrGM',
    '/ip6/2400:6180:0:d0::151:6001/tcp/4001/ipfs/QmSoLSafTMBsPKadTEgaXctDQVcqN88CNLHXMkTNwMKPnu',
    '/ip6/2604:a880:800:10::4a:5001/tcp/4001/ipfs/QmSoLV4Bbm51jM9C4gDYZQ9Cy3U6aXMJDAbzgu2fzaDs64',
    '/ip6/2a03:b0c0:0:1010::23:1001/tcp/4001/ipfs/QmSoLer265NRgSp2LA3dPaeykiS1J6DifTC88f5uVQKNAd',
  ]
}

async function createHeliaNode() {
  const helia = await createHelia({
    blockstore,
    datastore,
    libp2p: {
      peerDiscovery: [
        bootstrap({
          list: [
            '/dnsaddr/bootstrap.libp2p.io/p2p/QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN',
            '/dnsaddr/bootstrap.libp2p.io/p2p/QmbLHAnMoJPWSCR5Zhtx6BHJX9KiKNN6tpvbUcqanj75Nb',
            '/dnsaddr/bootstrap.libp2p.io/p2p/QmZa1sAxajnQjVM8WjWXoMbmPd7NsWhfKsPkErzpm9wGkp',
            '/dnsaddr/bootstrap.libp2p.io/p2p/QmQCU2EcMqAqQPR2i9bChDtGNJchTbq5TbXJJ16u19uLTa',
            '/dnsaddr/bootstrap.libp2p.io/p2p/QmcZf59bWwK5XFi76CZX8cbJ4BhTzzA3gU1ZjYZcYW3dwt',

            ...getAlternativePeers(),
          ],
        }),
      ],
      addresses: {
        listen: ['/ip4/0.0.0.0/tcp/6969'],
        announce: ['/ip4/3.65.60.26/tcp/6969']
      },
      transports: [tcp()],
      connectionEncrypters: [noise()],
      streamMuxers: [yamux()],
      services: {
        ping: ping(),
        dht: kadDHT({ clientMode: true }),
        identify: identify(),
      },
    },
  })

  fs = unixfs(helia)
  return { helia, fs }
}

;(async () => {
  try {
    const { helia } = await createHeliaNode()

    console.log('Local Helia node multi Addresses: ', helia.libp2p.getMultiaddrs())

    console.log(`Local Helia node is running with peer ID: ${helia.libp2p.peerId.toString()}`)

    const app = express()
    app.use(cors({ origin: '*' }))

    app.post('/pin', upload.single('file'), async (req: any, res: any) => {
      console.log('Received file upload request')

      if (!req.file) {
        console.error('No file received in the request')
        return res.status(400).send('No file uploaded.')
      }

      if (!fs) {
        console.error('Helia node is not ready')
        return res.status(500).send('Helia node is not ready.')
      }

      try {
        console.log('File received, size:', req.file.size)
        const fileData = new Uint8Array(req.file.buffer)
        console.log('Converting file to Uint8Array')

        console.log('Attempting to add file to IPFS')
        const cid = await fs.addBytes(fileData)
        console.log(`File pinned successfully. CID: ${cid.toString()}`)

        res.json({ cid: cid.toString() })
      } catch (error) {
        console.error('Error pinning the file:', error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        res.status(500).send(`Failed to pin the file: ${errorMessage}`)
      }
    })

    app.get('/pin/:cid', async (req: any, res: any) => {
      const { cid } = req.params

      if (!fs) {
        console.error('Helia node is not ready')
        return res.status(500).send('Helia node is not ready.')
      }

      try {
        console.log(`Checking if CID ${cid} is pinned`)
        const fileContent = await fs.cat(cid)
        const chunks = []

        for await (const chunk of fileContent) {
          chunks.push(chunk)
        }

        const fileBuffer = Buffer.concat(chunks)
        console.log(`CID ${cid} is pinned and content retrieved successfully`)

        res.send(fileBuffer)
      } catch (error) {
        console.error(`Error retrieving content for CID ${cid}:`, error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        res.status(500).send(`Failed to retrieve content for CID ${cid}: ${errorMessage}`)
      }
    })

    const PORT = process.env.PORT || 4444
    app.listen(PORT, () => {
      console.log(`IPFS Express server running on port ${PORT}`)
    })
  } catch (error) {
    console.error('Failed to initialize Helia or Express', error)
  }
})()
