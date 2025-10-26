const multicastDns = require('multicast-dns')

console.log('Looking specifically for _latentra._tcp.local services...')

const mdns = multicastDns()

mdns.on('response', (response) => {
  const allRecords = [...(response.answers || []), ...(response.additionals || [])]
  
  // Look for our service
  const latentraRecords = allRecords.filter(record => 
    record.name && record.name.includes('_latentra._tcp.local')
  )
  
  if (latentraRecords.length > 0) {
    console.log('🎉 Found Latentra services:')
    latentraRecords.forEach(record => {
      console.log(`  ${record.type}: ${record.name}`)
      if (record.data) {
        if (Array.isArray(record.data)) {
          record.data.forEach(item => {
            const str = Buffer.isBuffer(item) ? item.toString() : item
            console.log(`    Data: ${str}`)
          })
        } else {
          console.log(`    Data: ${JSON.stringify(record.data)}`)
        }
      }
    })
    console.log('---')
  }
})

// Query every 2 seconds
setInterval(() => {
  console.log('Querying for _latentra._tcp.local...')
  mdns.query({
    questions: [
      {
        name: '_latentra._tcp.local',
        type: 'PTR'
      }
    ]
  })
}, 2000)

// Initial query
mdns.query({
  questions: [
    {
      name: '_latentra._tcp.local',
      type: 'PTR'
    }
  ]
})

console.log('Press Ctrl+C to stop')

process.on('SIGINT', () => {
  console.log('\nStopping...')
  mdns.destroy()
  process.exit(0)
})
