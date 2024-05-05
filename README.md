# S.M.A (Send Messages Anonymously)

<div align="center">
  <img src="https://img.shields.io/badge/Svelte-FF3E00?style=flat&logo=svelte&logoColor=white" alt="svelte badge" />
  <img src="https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white" alt="typescript badge" />
  <img src="https://img.shields.io/badge/Node.js-43853D?style=flat&logo=node.js&logoColor=white" alt="node.js badge" />
  <img src="https://img.shields.io/badge/MongoDB-4EA94B?style=flat&logo=mongodb&logoColor=white" alt="mongodb badge" />
</div>

## Description

S.M.A is a web application that allows users to send messages to each other anonymously. It is built using Svelte and TypeScript, with a Node.js backend and MongoDB database.

## Features

- Send and receive messages anonymously
- Toggleable profanity filter

## Live Website

You can access the live website at [sma.robi.work](https://sma.robi.work/)

## Prerequisites

Before you begin, ensure you have met the following requirements:

- You have installed the latest version of Node.js and pnpm
- You have a MongoDB database set up.

## Installation

### Clone the repository:

```bash
git clone https://github.com/RobiMez/sma.git
cd sma
```

### Install the dependencies:

Using pnpm ( Preferred ):

```bash
pnpm i
```

### Create a `.env` file in the root directory of the project, and add the following line:

```bash
SECRET_MONGO_URI="your_mongodb_connection_string"
```

Replace `your_mongodb_connection_string` with your actual MongoDB connection string.

### Start the development server:

Using pnpm:

```bash
pnpm dev
```

You can find the site at `http://localhost:5173/`.

## Contributing

When working on the project , use [conventional commits](https://www.conventionalcommits.org/en/v1.0.0/).
Examples of conventional commits are:

- `feat(polling): Optimized polling algorithm`
- `fix(ui): Message box doesnt kill the site anymore`
- `refactor(api): New api endpoint for messages`
- `docs: updated documentation`
- `chore: smol fixes`
- `test: added tests for the new feature`
- `style: fixed the styling of the message box`
- `ci: added ci/cd pipeline`
- `perf: optimized the code`
- `revert: reverted the last commit`
- `build: added new build system`

You can use the following command to commit your changes and follow the conventional commits format:

```bash
pnpm commit
```

Contributions are welcome!
Please fork the repository and submit a pull request.
I'll review it as soon as possible.

## Credits

S.M.A was created by [Robi](https://github.com/RobiMez) and Improved with the help of [doniverse](https://github.com/doniverse) and [pilanop](https://github.com/pilanop)

## License

This project is licensed under the GNU General Public License v3.0
