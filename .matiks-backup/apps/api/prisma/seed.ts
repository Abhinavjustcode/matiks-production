import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const problems = [
  {
    id: "two-sum",
    slug: "two-sum",
    title: "Two Sum",
    difficulty: "EASY",
    description:
      "Given an array of integers and a target integer, return the indices of the two numbers whose sum equals the target. You may assume exactly one solution exists.",
    starterCode: {
      javascript: "function twoSum(nums, target) {\n  // write your solution\n}\n",
      python: "def two_sum(nums, target):\n    # write your solution\n    pass\n",
      cpp: "#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    // write your solution\n}\n",
      java: "import java.util.*;\n\nclass Main {\n    public static void main(String[] args) {\n        // write your solution\n    }\n}\n"
    },
    examples: [
      {input:"nums = [2,7,11,15], target = 9", output:"[0,1]"},
      {input:"nums = [3,2,4], target = 6", output:"[1,2]"}
    ],
    testCases: [
      {input:"[2,7,11,15]|9", output:"[0,1]"},
      {input:"[3,2,4]|6", output:"[1,2]"},
      {input:"[3,3]|6", output:"[0,1]"}
    ],
    constraints:"2 <= nums.length <= 10^4",
    tags:["array","hash-map","interview"]
  },
  {
    id: "reverse-string",
    slug: "reverse-string",
    title: "Reverse String",
    difficulty: "EASY",
    description:
      "Write a function that reverses a string. The input contains printable characters.",
    starterCode: {
      javascript: "function reverseString(s) {\n  // write your solution\n}\n",
      python: "def reverse_string(s):\n    # write your solution\n    pass\n",
      cpp: "#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    // write your solution\n}\n",
      java: "import java.util.*;\n\nclass Main {\n    public static void main(String[] args) {\n        // write your solution\n    }\n}\n"
    },
    examples: [
      {input:'s = "hello"', output:'"olleh"'},
      {input:'s = "MATIKS"', output:'"SKITAM"'}
    ],
    testCases: [
      {input:'"hello"', output:'"olleh"'},
      {input:'"MATIKS"', output:'"SKITAM"'},
      {input:'"abc"', output:'"cba"'}
    ],
    constraints:"1 <= s.length <= 10^5",
    tags:["string","two-pointer"]
  },
  {
    id: "valid-parentheses",
    slug: "valid-parentheses",
    title: "Valid Parentheses",
    difficulty: "MEDIUM",
    description:
      "Given a string containing parentheses, brackets and braces, determine whether the input string is valid. Every opening bracket must be closed by the same type.",
    starterCode: {
      javascript: "function isValid(s) {\n  // write your solution\n}\n",
      python: "def is_valid(s):\n    # write your solution\n    pass\n",
      cpp: "#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    // write your solution\n}\n",
      java: "import java.util.*;\n\nclass Main {\n    public static void main(String[] args) {\n        // write your solution\n    }\n}\n"
    },
    examples: [
      {input:'s = "()"', output:"true"},
      {input:'s = "()[]{}"', output:"true"},
      {input:'s = "(]"', output:"false"}
    ],
    testCases: [
      {input:'"()"', output:"true"},
      {input:'"()[]{}"', output:"true"},
      {input:'"(]"', output:"false"},
      {input:'"([{}])"', output:"true"}
    ],
    constraints:"1 <= s.length <= 10^4",
    tags:["stack","string"]
  },
  {
    id: "binary-search",
    slug: "binary-search",
    title: "Binary Search",
    difficulty: "MEDIUM",
    description:
      "Given a sorted array of distinct integers and a target value, return the index of the target. Return -1 if the target does not exist.",
    starterCode: {
      javascript: "function search(nums, target) {\n  // write your solution\n}\n",
      python: "def search(nums, target):\n    # write your solution\n    pass\n",
      cpp: "#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    // write your solution\n}\n",
      java: "import java.util.*;\n\nclass Main {\n    public static void main(String[] args) {\n        // write your solution\n    }\n}\n"
    },
    examples: [
      {input:"nums = [-1,0,3,5,9,12], target = 9", output:"4"},
      {input:"nums = [-1,0,3,5,9,12], target = 2", output:"-1"}
    ],
    testCases: [
      {input:"[-1,0,3,5,9,12]|9", output:"4"},
      {input:"[-1,0,3,5,9,12]|2", output:"-1"},
      {input:"[1,3,5,7,9]|1", output:"0"}
    ],
    constraints:"1 <= nums.length <= 10^5",
    tags:["binary-search","array"]
  }
];

async function main() {
  for (const p of problems) {
    await prisma.codingProblem.upsert({
      where:{id:p.id},
      update:p,
      create:p
    });
  }
  console.log(`Seeded ${problems.length} coding problems`);
}

main()
  .catch(console.error)
  .finally(()=>prisma.$disconnect());
