import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readFile, rm } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  assessComponentSpecReadiness,
  assessModelingPlanSemantics,
  validateComponentSpec,
  validateModelingPlan,
  validateQualityReport,
} from '../../src/domain/ai-cad/schemaValidation'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const args = parseArgs(process.argv.slice(2))
const specPath = resolveInput(args.spec, 'Missing --spec <path>.')
const planPath = resolveInput(args.plan, 'Missing --plan <path>.')
const outputDirectory = resolve(repoRoot, args.out ?? '.ai-cad-work/local-run')
const blenderExecutable = resolveBlenderExecutable(args.blender)
const compilerPath = resolve(repoRoot, 'workers/blender-compiler/compile_plan.py')

await rm(outputDirectory, { recursive: true, force: true })
await mkdir(outputDirectory, { recursive: true })

const specValue: unknown = JSON.parse(await readFile(specPath, 'utf8'))
const planValue: unknown = JSON.parse(await readFile(planPath, 'utf8'))
const specResult = validateComponentSpec(specValue)
const planResult = validateModelingPlan(planValue)

if (!specResult.success) fail('ComponentSpec Schema 校验失败。', specResult.errors)
if (!planResult.success) fail('ModelingPlan Schema 校验失败。', planResult.errors)

const readinessIssues = assessComponentSpecReadiness(specResult.data)
if (readinessIssues.length > 0) fail('ComponentSpec 尚未达到可建模状态。', readinessIssues)

const semanticIssues = assessModelingPlanSemantics(planResult.data, specResult.data)
if (semanticIssues.length > 0) fail('ModelingPlan 语义校验失败。', semanticIssues)

console.log(`BLENDER=${blenderExecutable}`)
console.log(`SPEC=${specPath}`)
console.log(`PLAN=${planPath}`)
console.log(`OUTPUT=${outputDirectory}`)

const exitCode = await runBlender(blenderExecutable, compilerPath, specPath, planPath, outputDirectory)
const reportPath = resolve(outputDirectory, 'quality-report.json')

if (!existsSync(reportPath)) fail(`Blender 未生成质量报告：${reportPath}`)

const reportValue: unknown = JSON.parse(await readFile(reportPath, 'utf8'))
const reportResult = validateQualityReport(reportValue)
if (!reportResult.success) fail('QualityReport Schema 校验失败。', reportResult.errors)
if (exitCode !== 0 || reportResult.data.status !== 'passed') {
  fail(`Blender 任务失败，exitCode=${exitCode}，QA=${reportResult.data.status}。`, reportResult.data.checks)
}

console.log(`PSD3_CAD_WORKER_RESULT=passed`)
console.log(`GLB=${resolve(outputDirectory, 'model.glb')}`)
console.log(`BLEND=${resolve(outputDirectory, 'model.blend')}`)
console.log(`REPORT=${reportPath}`)

function parseArgs(input: string[]) {
  const result: Record<string, string> = {}
  for (let index = 0; index < input.length; index += 2) {
    const key = input[index]
    const value = input[index + 1]
    if (!key?.startsWith('--') || !value) fail(`无效参数：${key ?? '<empty>'}`)
    result[key.slice(2)] = value
  }
  return result
}

function resolveInput(value: string | undefined, missingMessage: string) {
  if (!value) fail(missingMessage)
  const path = resolve(repoRoot, value)
  if (!existsSync(path)) fail(`文件不存在：${path}`)
  return path
}

function resolveBlenderExecutable(configuredPath?: string) {
  const candidates = [
    configuredPath,
    process.env.BLENDER_EXECUTABLE,
    'blender/blender-4.5.11-windows-x64/blender-4.5.11-windows-x64/blender.exe',
  ]
  for (const candidate of candidates) {
    if (!candidate) continue
    const path = resolve(repoRoot, candidate)
    if (existsSync(path)) return path
  }
  fail('未找到 Blender。请设置 --blender <path> 或 BLENDER_EXECUTABLE。')
}

function runBlender(executable: string, compiler: string, spec: string, plan: string, output: string) {
  return new Promise<number>((resolveExit, reject) => {
    const child = spawn(
      executable,
      [
        '--background',
        '--factory-startup',
        '--python-exit-code',
        '2',
        '--python',
        compiler,
        '--',
        '--spec',
        spec,
        '--plan',
        plan,
        '--output',
        output,
      ],
      { cwd: repoRoot, stdio: ['ignore', 'pipe', 'pipe'] },
    )

    child.stdout.on('data', (chunk) => process.stdout.write(chunk))
    child.stderr.on('data', (chunk) => process.stderr.write(chunk))
    child.on('error', reject)
    child.on('close', (code) => resolveExit(code ?? 1))
  })
}

function fail(message: string, details?: unknown): never {
  console.error(message)
  if (details !== undefined) console.error(JSON.stringify(details, null, 2))
  process.exit(1)
}
