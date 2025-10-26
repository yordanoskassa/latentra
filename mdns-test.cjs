const multicastDns = require('multicast-dns')

console.log('Testing mDNS discovery...')

const mdns = multicastDns()

// Listen for any mDNS responses
mdns.on('response', (response) => {
  console.log('mDNS Response received:')
  if (response.answers) {
    response.answers.forEach(answer => {
      console.log(`  ${answer.type}: ${answer.name} -> ${JSON.stringify(answer.data)}`)
    })
  }
  if (response.additionals) {
    response.additionals.forEach(additional => {
      console.log(`  Additional ${additional.type}: ${additional.name} -> ${JSON.stringify(additional.data)}`)
    })
  }
  console.log('---')
})

// Listen for queries
mdns.on('query', (query) => {
  console.log('mDNS Query received:')
  if (query.questions) {
    query.questions.forEach(q => {
      console.log(`  ${q.type}: ${q.name}`)
    })
  }
  console.log('---')
})

// Query for our service specifically
console.log('Querying for _latentra._tcp.local services...')
mdns.query({
  questions: [
    {
      name: '_latentra._tcp.local',
      type: 'PTR'
    }
  ]
})

// Query for all services
setTimeout(() => {
  console.log('Querying for all services...')
  mdns.query({
    questions: [
      {
        name: '_services._dns-sd._udp.local',
        type: 'PTR'
      }
    ]
  })
}, 2000)

console.log('Listening for mDNS traffic... Press Ctrl+C to stop')

process.on('SIGINT', () => {
  console.log('\nStopping mDNS test...')
  mdns.destroy()
  process.exit(0)
})
