#!/usr/bin/env node

const multicastDns = require('multicast-dns')
const os = require('os')

// Configuration
const deviceId = 'test-peer-' + Math.random().toString(36).substr(2, 9)
const deviceName = 'Lenovo'
const serviceType = '_latentra._tcp.local'
const apiPort = 3001

// System specs for testing
const systemSpecs = {
  cpu: 'Intel Core i7-9750H',
  memory: 16,
  vram: 4,
  platform: process.platform,
  arch: process.arch
}

console.log(`Starting test peer: ${deviceName} (${deviceId})`)
console.log(`System specs:`, systemSpecs)

const mdns = multicastDns()

// Get local IP addresses
function getLocalAddresses() {
  const addresses = []
  const interfaces = os.networkInterfaces()

  for (const name in interfaces) {
    const iface = interfaces[name]
    if (!iface) continue

    for (const details of iface) {
      if (!details.internal && details.family === 'IPv4') {
        addresses.push(details.address)
      }
    }
  }

  return addresses
}

// Announce our service
function announceService() {
  const hostname = os.hostname()
  const addresses = getLocalAddresses()

  console.log(`Announcing service on ${addresses.join(', ')}`)

  mdns.respond({
    answers: [
      {
        name: serviceType,
        type: 'PTR',
        ttl: 120,
        data: `${deviceName}.${serviceType}`
      },
      {
        name: `${deviceName}.${serviceType}`,
        type: 'SRV',
        ttl: 120,
        data: {
          port: apiPort,
          target: hostname,
          priority: 0,
          weight: 0
        }
      },
      {
        name: `${deviceName}.${serviceType}`,
        type: 'TXT',
        ttl: 120,
        data: [
          `id=${deviceId}`,
          `name=${deviceName}`,
          `platform=${systemSpecs.platform}`,
          `arch=${systemSpecs.arch}`,
          `cpu=${systemSpecs.cpu}`,
          `memory=${systemSpecs.memory}`,
          `vram=${systemSpecs.vram}`
        ]
      },
      ...addresses.map((addr) => ({
        name: hostname,
        type: addr.includes(':') ? 'AAAA' : 'A',
        ttl: 120,
        data: addr
      }))
    ]
  })
}

// Listen for queries and respond
mdns.on('query', (query) => {
  const hasOurService = query.questions?.some((q) => 
    q.name === serviceType && q.type === 'PTR'
  )
  if (hasOurService) {
    console.log('Received query for our service, responding...')
    announceService()
  }
})

// Listen for responses from other peers
mdns.on('response', (response) => {
  const allRecords = [...(response.answers || []), ...(response.additionals || [])]
  const ptrRecords = allRecords.filter((a) => a.type === 'PTR')
  
  for (const ptr of ptrRecords) {
    if (ptr.data && ptr.data.includes(serviceType) && !ptr.data.includes(deviceName)) {
      console.log(`Found peer: ${ptr.data}`)
    }
  }
})

// Query for peers
function queryPeers() {
  console.log('Querying for peers...')
  mdns.query({
    questions: [
      {
        name: serviceType,
        type: 'PTR'
      }
    ]
  })
}

// Start announcing and querying
announceService()
setInterval(() => announceService(), 20000)

queryPeers()
setInterval(() => queryPeers(), 5000)

console.log('✓ Test peer started - should be discoverable by Latentra')
console.log('Press Ctrl+C to stop')

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nStopping test peer...')
  mdns.destroy()
  process.exit(0)
})
