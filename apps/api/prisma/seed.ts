import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const problems = [
  {
    id: "two-sum",
    slug: "two-sum",
    title: "Two Sum",
    difficulty: "EASY",
    description:
      "Given an array of integers and a target integer, return the indices of the two numbers whose sum equals the target. Return the indices in any order.",
    starterCode: {
      javascript: `function twoSum(nums, target) {
  // write your solution
}
`,
      python: `def two_sum(nums, target):
    # write your solution
    pass
`,
      cpp: `#include <bits/stdc++.h>
using namespace std;

vector<int> twoSum(vector<int> nums, int target) {
    // write your solution
    return {};
}
`,
      java: `import java.util.*;

class Solution {
    public int[] twoSum(int[] nums, int target) {
        // write your solution
        return new int[]{};
    }
}
`,
    },
    examples: [
      { input: "nums = [2,7,11,15], target = 9", output: "[0,1]" },
      { input: "nums = [3,2,4], target = 6", output: "[1,2]" },
    ],
    testCases: [
      { input: [[2,7,11,15],9], output: [0,1] },
      { input: [[3,2,4],6], output: [1,2] },
      { input: [[3,3],6], output: [0,1] },
    ],
    constraints: "2 <= nums.length <= 10^4",
    tags: ["array","hash-map","interview"],
  },
  {
    id: "reverse-string",
    slug: "reverse-string",
    title: "Reverse String",
    difficulty: "EASY",
    description: "Write a function that reverses a string.",
    starterCode: {
      javascript: `function reverseString(s) {
  // write your solution
}
`,
      python: `def reverse_string(s):
    # write your solution
    pass
`,
      cpp: `#include <bits/stdc++.h>
using namespace std;

string reverseString(string s) {
    // write your solution
    return "";
}
`,
      java: `class Solution {
    public String reverseString(String s) {
        // write your solution
        return "";
    }
}
`,
    },
    examples: [
      { input: 's = "hello"', output: '"olleh"' },
      { input: 's = "MATIKS"', output: '"SKITAM"' },
    ],
    testCases: [
      { input: ["hello"], output: "olleh" },
      { input: ["MATIKS"], output: "SKITAM" },
      { input: ["abc"], output: "cba" },
    ],
    constraints: "1 <= s.length <= 10^5",
    tags: ["string","two-pointer"],
  },
  {
    id: "valid-parentheses",
    slug: "valid-parentheses",
    title: "Valid Parentheses",
    difficulty: "MEDIUM",
    description:
      "Given a string containing parentheses, brackets and braces, determine whether the input string is valid.",
    starterCode: {
      javascript: `function isValid(s) {
  // write your solution
}
`,
      python: `def is_valid(s):
    # write your solution
    pass
`,
      cpp: `#include <bits/stdc++.h>
using namespace std;

bool isValid(string s) {
    // write your solution
    return false;
}
`,
      java: `import java.util.*;

class Solution {
    public boolean isValid(String s) {
        // write your solution
        return false;
    }
}
`,
    },
    examples: [
      { input: 's = "()"', output: "true" },
      { input: 's = "()[]{}"', output: "true" },
      { input: 's = "(]"', output: "false" },
    ],
    testCases: [
      { input: ["()"], output: true },
      { input: ["()[]{}"], output: true },
      { input: ["(]"], output: false },
      { input: ["([{}])"], output: true },
    ],
    constraints: "1 <= s.length <= 10^4",
    tags: ["stack","string"],
  },
  {
    id: "binary-search",
    slug: "binary-search",
    title: "Binary Search",
    difficulty: "MEDIUM",
    description:
      "Given a sorted array of distinct integers and a target, return the target index or -1.",
    starterCode: {
      javascript: `function search(nums, target) {
  // write your solution
}
`,
      python: `def search(nums, target):
    # write your solution
    pass
`,
      cpp: `#include <bits/stdc++.h>
using namespace std;

int search(vector<int> nums, int target) {
    // write your solution
    return -1;
}
`,
      java: `class Solution {
    public int search(int[] nums, int target) {
        // write your solution
        return -1;
    }
}
`,
    },
    examples: [
      { input: "nums = [-1,0,3,5,9,12], target = 9", output: "4" },
      { input: "nums = [-1,0,3,5,9,12], target = 2", output: "-1" },
    ],
    testCases: [
      { input: [[-1,0,3,5,9,12],9], output: 4 },
      { input: [[-1,0,3,5,9,12],2], output: -1 },
      { input: [[1,3,5,7,9],1], output: 0 },
    ],
    constraints: "1 <= nums.length <= 10^5",
    tags: ["binary-search","array"],
  },
];

async function main() {
  for (const p of problems) {
    await prisma.codingProblem.upsert({
      where: { id: p.id },
      update: {
        slug: p.slug, title: p.title, difficulty: p.difficulty,
        description: p.description, starterCode: p.starterCode,
        examples: p.examples, testCases: p.testCases,
        constraints: p.constraints, tags: p.tags, active: true,
      },
      create: { ...p, active: true },
    });
  }
  console.log(`Seeded ${problems.length} coding problems`);
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
