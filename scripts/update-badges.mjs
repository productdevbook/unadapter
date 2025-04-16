// scripts/update-badges.mjs
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')

async function main() {
  try {
    // Read coverage data
    const coverageSummaryPath = path.join(projectRoot, 'coverage', 'coverage-summary.json')
    const coverageData = JSON.parse(await fs.readFile(coverageSummaryPath, 'utf-8'))

    // Extract coverage percentages
    const { total } = coverageData
    const linesCoverage = total.lines.pct.toFixed(2)
    const statementsCoverage = total.statements.pct.toFixed(2)
    const functionsCoverage = total.functions.pct.toFixed(2)
    const branchesCoverage = total.branches.pct.toFixed(2)

    // Determine colors based on coverage threshold
    const getColor = (percentage) => {
      if (percentage >= 80)
        return 'green'
      if (percentage >= 70)
        return 'yellowgreen'
      if (percentage >= 60)
        return 'yellow'
      if (percentage >= 50)
        return 'orange'
      return 'red'
    }

    const linesColor = getColor(total.lines.pct)
    const statementsColor = getColor(total.statements.pct)
    const functionsColor = getColor(total.functions.pct)
    const branchesColor = getColor(total.branches.pct)

    // Read README file
    const readmePath = path.join(projectRoot, 'README.md')
    let readmeContent = await fs.readFile(readmePath, 'utf-8')

    // Update coverage badges
    const coverageBadgePattern = /### Test Coverage[\s\S]*?<hr \/>/

    const newCoverageBadges = `### Test Coverage
![Lines](https://img.shields.io/badge/Lines-${linesCoverage}%25-${linesColor})
![Statements](https://img.shields.io/badge/Statements-${statementsCoverage}%25-${statementsColor})
![Functions](https://img.shields.io/badge/Functions-${functionsCoverage}%25-${functionsColor})
![Branches](https://img.shields.io/badge/Branches-${branchesCoverage}%25-${branchesColor})

**A universal adapter interface for connecting various databases and ORMs with a standardized API.**

<hr />`

    // Replace coverage badges section in README
    readmeContent = readmeContent.replace(coverageBadgePattern, newCoverageBadges)

    // Write updated README back to disk
    await fs.writeFile(readmePath, readmeContent)

    console.log('✅ README badges updated successfully!')
    console.log(`Coverage Stats:
- Lines:      ${linesCoverage}% (${linesColor})
- Statements: ${statementsCoverage}% (${statementsColor})
- Functions:  ${functionsCoverage}% (${functionsColor})
- Branches:   ${branchesCoverage}% (${branchesColor})`)
  }
  catch (error) {
    console.error('❌ Error updating README badges:', error)
    process.exit(1)
  }
}

main()
