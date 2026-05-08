# Project Details: Full Stack System Using an LLM

## Objective

Develop a simple full-stack application that allows users to interact with a Large Language Model (LLM). The system should enable users to send prompts to the LLM, display the results, and perform basic CRUD (Create, Read, Update, Delete) operations on the output.

## Requirements

### Query an LLM

Allow users to submit a prompt to an LLM of your choice. You may use any publicly available API (e.g., OpenAI).

### Retrieve and Display Results

Structure the LLM's response as a list, with each list item as a separate record. Feel free to format each record with a title and description, or keep it simple as a full paragraph. Display these records to the user in a web interface.

### CRUD Operations on Records

Enable users to view, edit, and delete each individual record in the web interface.

### Prompt Modification and Re-run

Allow users to edit the original prompt and re-query the LLM. Once modified, the user should be able to re-fetch, display, and perform CRUD operations on the new records. Any previous records should be automatically deleted when new records are created.

## Technology Stack

- **Frontend:** React (vanilla React) with react-query (`@tanstack/react-query`)
- **Backend:** TypeScript/Node.js (e.g., Express, Hono, Elysia, Fastify) with Drizzle ORM
- **Database:** SQLite, PGLite, Postgres (including Neon Postgres)
- **Languages:** TypeScript and React

## Setup Instructions

Ensure the application setup is simple and the application can be started with the following commands (using npm, pnpm, yarn, or bun, whichever you prefer):

- Install dependencies (e.g., `npm install` / `pnpm install` / `yarn` / `bun install`)
- Run database setup/migrations if required
- Start the application (e.g., `npm run dev` / `pnpm dev` / `yarn dev` / `bun dev`)

## Sample Prompt

> "I am an accountant, and my client is asking for advice on strategies to optimise his tax structure. He and his partner have an income of $200,000 per year. They live in Sydney, Australia, and have no kids. Please provide a detailed list of strategies that could minimise their tax. Please be very specific and use concise language."

## Sample Records

- **Salary Sacrifice into Superannuation**
  Encourage your client to make salary sacrifice contributions to their superannuation fund. These are taxed at 15%, which is lower than their marginal tax rate. The current cap is $27,500 per person per year, including employer contributions.

- **Spouse Superannuation Contributions**
  If one partner earns significantly less, the higher-income partner can contribute up to $3,000 to their spouse's superannuation and receive a tax offset of up to $540.

- **Negative Gearing on Investment Property**
  If they own an investment property or plan to purchase one, the interest on the loan and associated expenses can be claimed as a deduction. If the property is negatively geared (i.e., rental income is less than the expenses), it can reduce taxable income.

## Notes

- No user authentication or security is required.
- Ensure the user interface is simple and intuitive.
