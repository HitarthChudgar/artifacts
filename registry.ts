// Lives at the project root because Turbopack's import.meta.glob can't match `../` paths.
export const artifactModules = import.meta.glob("./artifacts/**/*.tsx", { eager: true });