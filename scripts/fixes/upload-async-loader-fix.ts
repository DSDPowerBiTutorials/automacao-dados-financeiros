import { promises as fs } from "fs"
import path from "path"

const reportDir = path.join(process.cwd(), "src", "app", "reports")
const logDir = path.join(process.cwd(), "logs")
const logFile = path.join(logDir, "upload_async_fix.log")

interface ScanResult {
  filePath: string
  issues: string[]
}

const syncPatterns: { description: string; regex: RegExp }[] = [
  { description: "Uso direto de window.Papa", regex: /window\.Papa/gi },
  { description: "Script síncrono do PapaParse", regex: /<Script[^>]*papaparse[^>]*>/gi },
  { description: "Import de next\/script para PapaParse", regex: /from\s+["']next\/script["']/gi }
]

async function ensureLogDir() {
  try {
    await fs.mkdir(logDir, { recursive: true })
  } catch (error) {
    console.error("❌ Não foi possível criar o diretório de logs:", error)
    throw error
  }
}

async function scanReportPages(): Promise<ScanResult[]> {
  try {
    const entries = await fs.readdir(reportDir, { withFileTypes: true })
    const pages = entries.filter(entry => entry.isDirectory())

    const results: ScanResult[] = []

    for (const folder of pages) {
      const filePath = path.join(reportDir, folder.name, "page.tsx")
      try {
        const code = await fs.readFile(filePath, "utf8")
        const issues = syncPatterns
          .map(pattern => (pattern.regex.test(code) ? pattern.description : null))
          .filter(Boolean) as string[]

        const usesHook = code.includes("usePapaParse")
        const referencesPapa = /Papa\.parse|window\.Papa/gi.test(code)

        if (issues.length > 0 || (referencesPapa && !usesHook)) {
          const messages = [...issues]
          if (referencesPapa && !usesHook) {
            messages.push("Página usa PapaParse sem o hook usePapaParse")
          }

          results.push({
            filePath,
            issues: messages
          })
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
          console.error(`❌ Erro ao analisar ${filePath}:`, error)
        }
      }
    }

    return results
  } catch (error) {
    console.error("❌ Erro ao varrer diretório de relatórios:", error)
    throw error
  }
}

async function main() {
  await ensureLogDir()
  const scanResults = await scanReportPages()

  if (!scanResults.length) {
    const message = "✅ Nenhum uso síncrono do PapaParse detectado. Todas as páginas utilizam carregamento assíncrono.\n"
    await fs.writeFile(logFile, message, "utf8")
    console.log(message.trim())
    return
  }

  const logLines: string[] = []
  for (const result of scanResults) {
    logLines.push(`⚠️  ${result.filePath}`)
    result.issues.forEach(issue => {
      logLines.push(`   - ${issue}`)
    })
  }

  logLines.push("\n❌ Migre os arquivos acima para o hook usePapaParse para evitar travamentos durante uploads.")

  await fs.writeFile(logFile, logLines.join("\n") + "\n", "utf8")

  console.error("❌ Uso síncrono de PapaParse encontrado. Consulte o log para detalhes:", logFile)
  process.exitCode = 1
}

main().catch(error => {
  console.error("❌ Falha ao executar verificação de carregamento assíncrono:", error)
  process.exit(1)
})
