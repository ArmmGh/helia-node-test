import { createHelia } from 'helia'
import { LevelDatastore } from 'datastore-level'
import { LevelBlockstore } from 'blockstore-level'
import { unixfs } from '@helia/unixfs'
import type { Libp2p } from 'libp2p'
import { identify } from '@libp2p/identify'
import { tcp } from '@libp2p/tcp'
import { noise } from '@chainsafe/libp2p-noise'
import { yamux } from '@chainsafe/libp2p-yamux'
import { bootstrap } from '@libp2p/bootstrap'
import { mdns } from '@libp2p/mdns'
import { ping } from '@libp2p/ping'
import { kadDHT } from '@libp2p/kad-dht'
import { webSockets } from '@libp2p/websockets'
import {
  createDelegatedRoutingV1HttpApiClient,
  DelegatedRoutingV1HttpApiClient,
} from '@helia/delegated-routing-v1-http-api-client'

const addListeners = (libp2p: Libp2p) => {
  libp2p.addEventListener('peer:connect', (evt) => {
    const connection = evt.detail
    console.log(`Connected to ${connection.toString()}`)
  })

  libp2p.addEventListener('peer:discovery', (peerId) => {
    // No need to dial, autoDial is on
    console.log('Discovered Peer with ID:', peerId.detail.id.toString())
  })

  // Listen for peers disconnecting
  libp2p.addEventListener('peer:disconnect', (evt) => {
    const connection = evt.detail
    console.log(`Disconnected from ${connection.toCID().toString()}`)
  })
}

const blockstore = new LevelBlockstore('blockstore')
const datastore = new LevelDatastore('datastore')

async function createHeliaNode() {
  // const datastore = new LevelDatastore('path/to/persistent/datastore');
  const delegatedClient = createDelegatedRoutingV1HttpApiClient('https://delegated-ipfs.dev')

  const helia = await createHelia({
    blockstore,
    datastore,
    libp2p: {
      peerDiscovery: [
        mdns(),
        bootstrap({
          list: [
            '/dnsaddr/bootstrap.libp2p.io/p2p/QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN',
            '/dnsaddr/bootstrap.libp2p.io/p2p/QmbLHAnMoJPWSCR5Zhtx6BHJX9KiKNN6tpvbUcqanj75Nb',
            '/dnsaddr/bootstrap.libp2p.io/p2p/QmZa1sAxajnQjVM8WjWXoMbmPd7NsWhfKsPkErzpm9wGkp',
            '/dnsaddr/bootstrap.libp2p.io/p2p/QmQCU2EcMqAqQPR2i9bChDtGNJchTbq5TbXJJ16u19uLTa',
            '/dnsaddr/bootstrap.libp2p.io/p2p/QmcZf59bWwK5XFi76CZX8cbJ4BhTzzA3gU1ZjYZcYW3dwt',

            '/ip4/104.131.131.82/tcp/4001/ipfs/QmaCpDMGvV2BGHeYERUEnRQAwe3N8SzbUtfsmvsqQLuvuJ',
            '/ip4/104.236.179.241/tcp/4001/ipfs/QmSoLPppuBtQSGwKDZT2M73ULpjvfd3aZ6ha4oFGL1KrGM',
            '/ip4/128.199.219.111/tcp/4001/ipfs/QmSoLSafTMBsPKadTEgaXctDQVcqN88CNLHXMkTNwMKPnu',
            '/ip4/104.236.76.40/tcp/4001/ipfs/QmSoLV4Bbm51jM9C4gDYZQ9Cy3U6aXMJDAbzgu2fzaDs64',
            '/ip4/178.62.158.247/tcp/4001/ipfs/QmSoLer265NRgSp2LA3dPaeykiS1J6DifTC88f5uVQKNAd',
            '/ip6/2604:a880:1:20::203:d001/tcp/4001/ipfs/QmSoLPppuBtQSGwKDZT2M73ULpjvfd3aZ6ha4oFGL1KrGM',
            '/ip6/2400:6180:0:d0::151:6001/tcp/4001/ipfs/QmSoLSafTMBsPKadTEgaXctDQVcqN88CNLHXMkTNwMKPnu',
            '/ip6/2604:a880:800:10::4a:5001/tcp/4001/ipfs/QmSoLV4Bbm51jM9C4gDYZQ9Cy3U6aXMJDAbzgu2fzaDs64',
            '/ip6/2a03:b0c0:0:1010::23:1001/tcp/4001/ipfs/QmSoLer265NRgSp2LA3dPaeykiS1J6DifTC88f5uVQKNAd',
          ],
        }),
      ],

      addresses: {
        listen: [
          // add a listen address (localhost) to accept TCP connections on a random port
          // '/dns4/6.tcp.eu.ngrok.io/tcp/11576',
          // '/ip4/127.0.0.1/tcp/6969',
          '/ip4/0.0.0.0/tcp/6969',
          //'/ip4/127.0.0.1/tcp/6969',
          //'/ip4/3.65.60.26/tcp/6969',
          // '/ip4/0.0.0.0/tcp/6969',
          // '/dns4/telebit.cloud/tcp/49616',
          // '/dns4/telebit.cloud/tcp/49616',
          // '/ip4/188.169.241.111/tcp/6969',
        ],
      },
      transports: [webSockets(), tcp()],
      connectionEncrypters: [noise()],
      streamMuxers: [yamux()],
      services: {
        identify: identify(),
        delegatedRouting: () => delegatedClient,
        ping: ping(),
        dht: kadDHT({ clientMode: false }),
      },
    },
  })

  const fs = unixfs(helia)

  return { helia, fs }
}

;(async () => {
  const { helia } = await createHeliaNode()
  try {
    addListeners(helia.libp2p)

    console.log('Local Helia node multi Addresses: ', helia.libp2p.getMultiaddrs())

    console.log(`Local Helia node is running with peer ID: ${helia.libp2p.peerId.toString()}`)

    console.log('Testing local Node connections ....')

    // const node2 = await createHeliaNode()

    // try {
    //   await node2.helia.libp2p.dial(helia.libp2p.peerId)
    //   console.log('Connection successful between node2 and helia node')
    // } catch (error) {
    //   console.log('Error dialing remote peer:', error)
    // }
  } catch (error) {
    helia.stop()
  }
})()
