const fs = require('fs')
const bytes = require('bytes')
const glob = require('glob')
const { error } = require('prettycli')
const config = require('./config')
const debug = require('./debug')

const files = []

config.map(file => {
  const paths = glob.sync(file.path)
  if (!paths.length) {
    error(`There is no matching file for ${file.path} in ${process.cwd()}`, {
      silent: true
    })
  } else {
    paths.map(path => {
      const maxSize = bytes(file.threshold || file.maxSize || file.zlib && file.zlib.maxSize) || Infinity

      const content = fs.readFileSync(path, 'utf8')

      const brotliOpts = (file.brotli && file.brotli.level) ? {quality: file.brotli.level} : undefined

      const zlibOpts = (file.level || file.zlib) ? {level: file.level || file.zlib.level} : undefined

      const zopfliOpts = (file.level || file.zopfli) ? {level: file.level || file.zopfli.level} : undefined

      files.push({
        path,
        hidePass: file.hidePass,
        real: {
          size: file.real ? fs.statSync(path).size : null,
          maxSize: (file.real && file.real.maxSize) ? bytes(file.real.maxSize) : maxSize,
        },
        brotli: {
          size: file.brotli ? require('brotli-size').sync(content, brotliOpts) : null,
          maxSize: (file.brotli && file.brotli.maxSize) ? bytes(file.brotli.maxSize) : maxSize,
          level: file.brotli ? (file.brotli.level || file.level) : file.level,
        },
        zlib: {
          size: file.zlib || file.maxSize ? require('gzip-size').sync(content, zlibOpts) : null,
          maxSize: maxSize,
          level: file.zlib ? (file.zlib.level || file.level) : file.level,
        },
        zopfli: {
          size: file.zopfli ? require('zopfli-size').sync(content, zopfliOpts) : null,
          maxSize: (file.zopfli && file.zopfli.maxSize) ? bytes(file.zopfli.maxSize) : maxSize,
          level: file.zopfli ? (file.zopfli.level || file.level) : file.level,
        }
      })
    })
  }
})

debug('files', files)

module.exports = files
