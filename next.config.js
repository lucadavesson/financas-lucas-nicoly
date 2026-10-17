/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // pdf.js tenta carregar o pacote "canvas" só no Node; no navegador ele não existe nem é preciso
    config.resolve.alias = { ...config.resolve.alias, canvas: false }
    config.resolve.fallback = { ...config.resolve.fallback, fs: false, path: false, zlib: false, stream: false, http: false, https: false, url: false }
    return config
  },
}
module.exports = nextConfig
