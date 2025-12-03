export type ParseStepResult<T = any> = {
  data: T
  errors: unknown[]
  meta: {
    fields: string[]
  }
}

export type ParseConfig<T = any> = {
  header?: boolean
  skipEmptyLines?: boolean
  worker?: boolean
  step?: (row: ParseStepResult<T>) => void | Promise<void>
  complete?: () => void
}

const parseCSVLine = (line: string) => {
  const values: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    const nextChar = line[i + 1]

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current)
      current = ''
    } else {
      current += char
    }
  }

  values.push(current)
  return values
}

const processLines = async <T>(
  lines: string[],
  headers: string[] | null,
  config: ParseConfig<T>
) => {
  let currentHeaders = headers

  for (const line of lines) {
    if (config.skipEmptyLines && line.trim() === '') continue

    const parsedValues = parseCSVLine(line)

    if (config.header) {
      if (!currentHeaders) {
        currentHeaders = parsedValues
        continue
      }

      const data = currentHeaders.reduce((acc, header, index) => {
        acc[header] = parsedValues[index] ?? ''
        return acc
      }, {} as Record<string, string>) as T

      if (config.step) {
        await config.step({ data, errors: [], meta: { fields: currentHeaders } })
      }
    } else if (config.step) {
      await config.step({ data: parsedValues as T, errors: [], meta: { fields: [] } })
    }
  }

  return currentHeaders
}

const parse = <T = any>(file: File | Blob, config: ParseConfig<T>) => {
  const reader = file.stream().getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let headers: string[] | null = null

  const readChunk = async (): Promise<void> => {
    const { value, done } = await reader.read()
    if (value) {
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split(/\r?\n/)
      buffer = lines.pop() ?? ''
      headers = await processLines(lines, headers, config)
    }

    if (done) {
      if (buffer !== '' && (!config.skipEmptyLines || buffer.trim() !== '')) {
        headers = await processLines([buffer], headers, config)
      }
      config.complete?.()
      return
    }

    return readChunk()
  }

  void readChunk()
}

const Papa = { parse }

export default Papa
