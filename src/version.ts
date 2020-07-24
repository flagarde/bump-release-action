import * as semver from "semver";
import { Option } from "./option";
import { Config } from "./config";
import { Release } from "./release";
import { Changes } from "./calculate";
import { PullRequest } from "./pull_request";
import { Commit } from "./commit";

export const versionList = ["major", "minor", "patch"] as const;

export type Version = typeof versionList[number];

export function calculateCurrentVersion(config: Config, release: Release | null): string {
    if (release == null) {
        return config.release.initialVersion;
    }
    return cleanTagName(config, release.tagName);
}

export function calculateNextVersion(
    option: Option,
    config: Config,
    release: Release | null,
    changes: Changes[]
): string {
    const currentVersion = calculateCurrentVersion(config, release);
    let major = semver.major(currentVersion);
    let minor = semver.minor(currentVersion);
    let patch = semver.patch(currentVersion);
    let bump: Version = config.bump.default;

    for (const change of changes) {
        if (bump == "major") {
            break;
        }
        if (change.type == "pull_request") {
            const pullRequest = change.value as PullRequest;
            const labels = pullRequest.labels.map((x) => x.name);
            for (const label of labels) {
                if (config.bump.major.labels.includes(label)) {
                    bump = "major";
                    break;
                }
                if (config.bump.minor.labels.includes(label)) {
                    bump = "minor";
                    break;
                }
                if (bump == "minor") {
                    continue;
                }
                if (config.bump.patch.labels.includes(label)) {
                    bump = "patch";
                    break;
                }
            }
        } else if (change.type == "commit") {
            const commit = change.value as Commit;
            let found = false;
            for (const prefix of config.bump.major.commits) {
                if (commit.message.startsWith(prefix)) {
                    bump = "major";
                    found = true;
                    break;
                }
            }
            if (found) {
                continue;
            }
            for (const prefix of config.bump.minor.commits) {
                if (commit.message.startsWith(prefix)) {
                    bump = "minor";
                    found = true;
                    break;
                }
            }
            if (found) {
                continue;
            }
            if (bump == "minor") {
                continue;
            }
            for (const prefix of config.bump.patch.commits) {
                if (commit.message.startsWith(prefix)) {
                    bump = "patch";
                    found = true;
                    break;
                }
            }
        }
    }
    if (option.bump != null) {
        bump = option.bump;
    }

    if (bump == "major") {
        major += 1;
        minor = 0;
        patch = 0;
    }
    if (bump == "minor") {
        minor += 1;
        patch = 0;
    }
    if (bump == "patch") {
        patch += 1;
    }

    return `${major}.${minor}.${patch}`;
}

export function cleanTagName(config: Config, tagName: string): string {
    let result = tagName;
    if (config.release.tagPrefix != null && result.startsWith(config.release.tagPrefix)) {
        result = result.slice(config.release.tagPrefix.length, result.length);
    }
    if (config.release.tagPostfix != null && result.endsWith(config.release.tagPostfix)) {
        result = result.slice(0, result.length - config.release.tagPostfix.length);
    }
    const resultOrNull = semver.clean(result);
    if (resultOrNull == null) {
        throw new Error(`unresolve tag: ${tagName}`);
    }

    return resultOrNull;
}
