// Test what require('electron') actually returns
const electronModule = require('electron')
console.log('=== DEBUG ===')
console.log('Type:', typeof electronModule)
console.log('Is string:', typeof electronModule === 'string')
if (typeof electronModule === 'string') {
  console.log('Content:', electronModule)
} else {
  console.log('Keys:', Object.keys(electronModule).slice(0, 20))
  console.log('nativeImage type:', typeof electronModule.nativeImage)
  console.log('app type:', typeof electronModule.app)
}
process.exit(0)
