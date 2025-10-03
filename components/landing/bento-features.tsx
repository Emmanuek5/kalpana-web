"use client";

import React, { useState, useEffect } from "react";
import {
  Code2,
  Github,
  Terminal,
  Users,
  MessagesSquare,
  GitBranch,
  GitPullRequest,
  Star,
} from "lucide-react";

export function BentoGridFeatures() {
  return (
    <div className="relative container mx-auto px-6 py-32">
      <div className="text-center mb-20">
        <h2 className="text-5xl font-normal tracking-tight mb-4">
          Everything You Need to Code
        </h2>
        <p className="text-zinc-500 text-lg">
          A complete cloud development platform with powerful features
        </p>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-6 gap-4">
        {/* Large: AI Agent Chat */}
        <div className="md:col-span-3 md:row-span-2 group relative overflow-hidden rounded-2xl bg-zinc-900 border border-zinc-800 p-8 hover:border-emerald-500/30 transition-all">
          <div className="mb-6">
            <div className="h-12 w-12 rounded-xl bg-emerald-500/5 border border-emerald-500/20 flex items-center justify-center mb-4">
              <MessagesSquare className="h-6 w-6 text-emerald-400" />
            </div>
            <h3 className="text-2xl font-medium mb-2 text-zinc-100">
              AI-Powered Assistant
            </h3>
            <p className="text-zinc-500">
              Chat with AI to write code, run commands, and more
            </p>
          </div>
          <AIAgentDemo />
        </div>

        {/* Medium: Live IDE */}
        <div className="md:col-span-3 md:row-span-2 group relative overflow-hidden rounded-2xl bg-zinc-900 border border-zinc-800 p-8 hover:border-emerald-500/30 transition-all">
          <div className="mb-6">
            <div className="h-12 w-12 rounded-xl bg-emerald-500/5 border border-emerald-500/20 flex items-center justify-center mb-4">
              <Code2 className="h-6 w-6 text-emerald-400" />
            </div>
            <h3 className="text-2xl font-medium mb-2 text-zinc-100">
              Full VSCode Experience
            </h3>
            <p className="text-zinc-500">
              Complete editor with extensions and themes
            </p>
          </div>
          <MiniIDEDemo />
        </div>

        {/* Small: Terminal */}
        <div className="md:col-span-2 group relative overflow-hidden rounded-2xl bg-zinc-900 border border-zinc-800 p-6 hover:border-emerald-500/30 transition-all">
          <div className="h-10 w-10 rounded-xl bg-emerald-500/5 border border-emerald-500/20 flex items-center justify-center mb-4">
            <Terminal className="h-5 w-5 text-emerald-400" />
          </div>
          <h3 className="text-xl font-medium mb-2 text-zinc-100">
            Terminal Access
          </h3>
          <p className="text-zinc-500 text-sm">Full shell with any command</p>
          <TerminalDemo />
        </div>

        {/* Small: GitHub - ENHANCED */}
        <div className="md:col-span-2 group relative overflow-hidden rounded-2xl bg-zinc-900 border border-zinc-800 p-6 hover:border-emerald-500/30 transition-all">
          <div className="h-10 w-10 rounded-xl bg-emerald-500/5 border border-emerald-500/20 flex items-center justify-center mb-4">
            <Github className="h-5 w-5 text-emerald-400" />
          </div>
          <h3 className="text-xl font-medium mb-2 text-zinc-100">
            GitHub Integration
          </h3>
          <p className="text-zinc-500 text-sm">Clone any repo instantly</p>
          <GitHubDemo />
        </div>

        {/* Small: Collaboration - ENHANCED */}
        <div className="md:col-span-2 group relative overflow-hidden rounded-2xl bg-zinc-900 border border-zinc-800 p-6 hover:border-emerald-500/30 transition-all">
          <div className="h-10 w-10 rounded-xl bg-emerald-500/5 border border-emerald-500/20 flex items-center justify-center mb-4">
            <Users className="h-5 w-5 text-emerald-400" />
          </div>
          <h3 className="text-xl font-medium mb-2 text-zinc-100">
            Real-time Collaboration
          </h3>
          <p className="text-zinc-500 text-sm">Code together seamlessly</p>
          <CollaborationDemo />
        </div>
      </div>
    </div>
  );
}

// Enhanced AI Agent Chat Animation
function AIAgentDemo() {
  const [messages, setMessages] = useState([
    {
      role: "user",
      text: "Create a React component for user auth",
      time: "2:34 PM",
    },
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const [typedResponse, setTypedResponse] = useState("");

  const fullResponse =
    "I'll create an authentication component with login and signup forms. Let me generate that for you...";

  useEffect(() => {
    const runAnimation = () => {
      setIsTyping(true);
      setTypedResponse("");

      let charIndex = 0;
      const typeInterval = setInterval(() => {
        if (charIndex < fullResponse.length) {
          setTypedResponse(fullResponse.slice(0, charIndex + 1));
          charIndex++;
        } else {
          clearInterval(typeInterval);
          setTimeout(() => {
            setMessages((prev) => [
              ...prev,
              {
                role: "assistant",
                text: fullResponse,
                time: "2:34 PM",
              },
            ]);
            setIsTyping(false);
            setTypedResponse("");
            
            // Reset and loop after 3 seconds
            setTimeout(() => {
              setMessages([{
                role: "user",
                text: "Create a React component for user auth",
                time: "2:34 PM",
              }]);
              runAnimation();
            }, 3000);
          }, 500);
        }
      }, 30);

      return () => clearInterval(typeInterval);
    };

    const timer = setTimeout(runAnimation, 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="space-y-3">
      {messages.map((msg, i) => (
        <div key={i} className="flex gap-3 items-start">
          <div
            className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${
              msg.role === "user"
                ? "bg-emerald-500"
                : "bg-gradient-to-br from-purple-500 to-pink-500"
            }`}
          >
            <span className="text-white text-xs font-medium">
              {msg.role === "user" ? "U" : "AI"}
            </span>
          </div>
          <div className="flex-1">
            <div
              className={`p-4 rounded-xl ${
                msg.role === "user"
                  ? "bg-emerald-500/10 border border-emerald-500/20"
                  : "bg-zinc-800/80 border border-zinc-700/50"
              }`}
            >
              <p
                className={`text-sm leading-relaxed ${
                  msg.role === "user" ? "text-emerald-100" : "text-zinc-200"
                }`}
              >
                {msg.text}
              </p>
            </div>
            <span className="text-[10px] text-zinc-600 mt-1 block">
              {msg.time}
            </span>
          </div>
        </div>
      ))}
      {isTyping && (
        <div className="flex gap-3 items-start">
          <div className="h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-purple-500 to-pink-500">
            <span className="text-white text-xs font-medium">AI</span>
          </div>
          <div className="flex-1">
            <div className="p-4 rounded-xl bg-zinc-800/80 border border-zinc-700/50">
              <p className="text-sm leading-relaxed text-zinc-200">
                {typedResponse}
                <span className="inline-block w-1 h-4 bg-emerald-500 ml-0.5 animate-pulse" />
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Enhanced Mini IDE Animation with syntax highlighting
function MiniIDEDemo() {
  const [currentLine, setCurrentLine] = useState(0);
  const [charIndex, setCharIndex] = useState(0);

  const codeLines = [
    {
      line: 1,
      text: "import",
      color: "text-purple-400",
      rest: " React from ",
      rest2: "'react'",
      rest2Color: "text-emerald-400",
    },
    {
      line: 3,
      text: "function",
      color: "text-purple-400",
      rest: " ",
      rest2: "AuthForm",
      rest2Color: "text-blue-400",
      rest3: "() {",
    },
    { line: 4, text: "  return", color: "text-purple-400", rest: " (" },
    {
      line: 5,
      text: "    <div",
      color: "text-blue-300",
      rest: " ",
      rest2: "className",
      rest2Color: "text-blue-400",
      rest3: "=",
      rest4: '"form"',
      rest4Color: "text-emerald-400",
      rest5: ">",
    },
    {
      line: 6,
      text: "      <input",
      color: "text-blue-300",
      rest: " ",
      rest2: "type",
      rest2Color: "text-blue-400",
      rest3: "=",
      rest4: '"email"',
      rest4Color: "text-emerald-400",
      rest5: " />",
    },
    {
      line: 7,
      text: "      <button>",
      color: "text-blue-300",
      rest: "Sign In</button>",
      restColor: "text-zinc-300",
    },
    { line: 8, text: "    </div>", color: "text-blue-300" },
    { line: 9, text: "  );", color: "text-zinc-300" },
    { line: 10, text: "}", color: "text-zinc-300" },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentLine((prev) => {
        if (prev < codeLines.length - 1) {
          return prev + 1;
        } else {
          // Reset and loop
          setTimeout(() => setCurrentLine(0), 2000);
          return prev;
        }
      });
    }, 400);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl">
      {/* VSCode Header */}
      <div className="bg-zinc-900 border-b border-zinc-800 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <div className="h-3 w-3 rounded-full bg-red-500 hover:bg-red-400 transition-colors" />
            <div className="h-3 w-3 rounded-full bg-yellow-500 hover:bg-yellow-400 transition-colors" />
            <div className="h-3 w-3 rounded-full bg-emerald-500 hover:bg-emerald-400 transition-colors" />
          </div>
          <div className="flex items-center gap-2 bg-zinc-950 px-3 py-1 rounded border border-zinc-800">
            <Code2 className="h-3 w-3 text-blue-400" />
            <span className="text-xs text-zinc-400">AuthForm.tsx</span>
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-[10px] text-zinc-600">TypeScript React</div>
        </div>
      </div>

      {/* Code Editor */}
      <div className="p-4 font-mono text-xs h-56 overflow-hidden bg-gradient-to-b from-zinc-950 to-zinc-900">
        <div className="space-y-1">
          {codeLines.slice(0, currentLine + 1).map((line, i) => (
            <div key={i} className="flex items-start gap-4 group">
              <span className="text-zinc-700 select-none w-6 text-right">
                {line.line}
              </span>
              <div className="flex-1">
                {i === currentLine ? (
                  <span className={line.color}>
                    {line.text}
                    <span className={line.rest2Color}>{line.rest2}</span>
                    <span className="text-zinc-300">{line.rest3}</span>
                    <span className={line.rest4Color}>{line.rest4}</span>
                    <span className="text-zinc-300">{line.rest5}</span>
                    <span className="inline-block w-1.5 h-3.5 bg-emerald-500 ml-0.5 animate-pulse" />
                  </span>
                ) : (
                  <span>
                    <span className={line.color}>{line.text}</span>
                    <span className="text-zinc-400">{line.rest}</span>
                    <span className={line.rest2Color}>{line.rest2}</span>
                    <span className="text-zinc-400">{line.rest3}</span>
                    <span className={line.rest4Color}>{line.rest4}</span>
                    <span className="text-zinc-400">{line.rest5}</span>
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Status Bar */}
      <div className="bg-emerald-500 px-4 py-1 flex items-center justify-between text-[10px]">
        <div className="flex items-center gap-3 text-zinc-950 font-medium">
          <span>✓ No errors</span>
          <span>Ln {currentLine + 1}, Col 1</span>
        </div>
        <div className="text-zinc-950">UTF-8</div>
      </div>
    </div>
  );
}

// Enhanced Terminal Animation
function TerminalDemo() {
  const [lines, setLines] = useState<Array<{ text: string; type: string }>>([]);
  const [currentLine, setCurrentLine] = useState(0);

  const terminalLines = [
    { text: "$ npm install", type: "command" },
    { text: "✓ Installed 234 packages", type: "success" },
    { text: "$ npm run dev", type: "command" },
    { text: "⚡ Starting development server...", type: "info" },
    { text: "✓ Ready on http://localhost:3000", type: "success" },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentLine((prev) => {
        if (prev < terminalLines.length - 1) {
          const nextLine = prev + 1;
          setLines((prevLines) => [...prevLines, terminalLines[nextLine]]);
          return nextLine;
        } else {
          // Reset and loop
          setTimeout(() => {
            setCurrentLine(0);
            setLines([terminalLines[0]]);
          }, 2000);
          return prev;
        }
      });
    }, 800);

    // Initialize with first line
    setLines([terminalLines[0]]);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="mt-4 bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden">
      <div className="bg-zinc-900 border-b border-zinc-800 px-3 py-1.5 flex items-center gap-2">
        <Terminal className="h-3 w-3 text-emerald-500" />
        <span className="text-[10px] text-zinc-500">zsh</span>
      </div>
      <div className="p-3 font-mono text-[10px] h-24 overflow-hidden space-y-1">
        {lines.map((line, i) => (
          <div
            key={i}
            className={`${
              line.type === "command"
                ? "text-emerald-400"
                : line.type === "success"
                ? "text-emerald-500"
                : "text-blue-400"
            }`}
          >
            {line.text}
            {i === lines.length - 1 &&
              currentLine < terminalLines.length - 1 && (
                <span className="inline-block w-1.5 h-3 bg-emerald-500 ml-1 animate-pulse" />
              )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Terminal-style GitHub Clone Demo
function GitHubDemo() {
  const [lines, setLines] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState(0);

  const terminalSteps = [
    "$ git clone https://github.com/user/awesome-project.git",
    "Cloning into 'awesome-project'...",
    "remote: Enumerating objects: 2847, done.",
    "remote: Counting objects: 100% (2847/2847), done.",
    "remote: Compressing objects: 100% (1523/1523), done.",
    "Receiving objects: 100% (2847/2847), 4.2 MiB | 8.5 MiB/s, done.",
    "Resolving deltas: 100% (1234/1234), done.",
    "$ cd awesome-project",
    "$ npm install",
    "✓ Dependencies installed successfully",
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev < terminalSteps.length - 1) {
          const nextStep = prev + 1;
          setLines((prevLines) => [...prevLines, terminalSteps[nextStep]]);
          return nextStep;
        } else {
          // Reset and loop
          setTimeout(() => {
            setCurrentStep(0);
            setLines([terminalSteps[0]]);
          }, 2000);
          return prev;
        }
      });
    }, 600);

    // Initialize with first line
    setLines([terminalSteps[0]]);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="mt-4 bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden">
      {/* Terminal Header */}
      <div className="bg-zinc-900 border-b border-zinc-800 px-3 py-2 flex items-center gap-2">
        <div className="flex gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
          <div className="h-2.5 w-2.5 rounded-full bg-yellow-500" />
          <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
        </div>
        <div className="flex items-center gap-2 flex-1">
          <Terminal className="h-3 w-3 text-emerald-500" />
          <span className="text-[10px] text-zinc-500">terminal — bash</span>
        </div>
      </div>

      {/* Terminal Content */}
      <div className="p-3 h-32 overflow-hidden font-mono text-[10px] space-y-1">
        {lines.map((line, i) => (
          <div
            key={i}
            className={`${
              line.startsWith("$")
                ? "text-emerald-400"
                : line.startsWith("✓")
                ? "text-emerald-500"
                : line.includes("remote:")
                ? "text-blue-400"
                : line.includes("Receiving") || line.includes("Resolving")
                ? "text-yellow-400"
                : "text-zinc-400"
            }`}
          >
            {line}
            {i === lines.length - 1 &&
              currentStep < terminalSteps.length - 1 && (
                <span className="inline-block w-1.5 h-3 bg-emerald-500 ml-0.5 animate-pulse" />
              )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Enhanced Real-time Collaboration Demo
function CollaborationDemo() {
  const [users, setUsers] = useState([
    { name: "Alice", color: "#ec4899", initial: "A", line: 2, editing: false },
  ]);
  const [code, setCode] = useState([
    "function collaborate() {",
    "  return <Team />",
    "}",
  ]);

  useEffect(() => {
    // Add more users over time
    const timer1 = setTimeout(() => {
      setUsers((prev) => [
        ...prev,
        {
          name: "Bob",
          color: "#3b82f6",
          initial: "B",
          line: 1,
          editing: false,
        },
      ]);
    }, 1500);

    const timer2 = setTimeout(() => {
      setUsers((prev) => [
        ...prev,
        {
          name: "Carol",
          color: "#a855f7",
          initial: "C",
          line: 2,
          editing: false,
        },
      ]);
    }, 2500);

    // Simulate code edits
    const editTimer = setTimeout(() => {
      setUsers((prev) =>
        prev.map((u, i) => (i === 0 ? { ...u, editing: true } : u))
      );

      setTimeout(() => {
        setCode([
          "function collaborate() {",
          "  const team = useTeam()",
          "  return <Team members={team} />",
          "}",
        ]);
        setUsers((prev) =>
          prev.map((u, i) => (i === 0 ? { ...u, editing: false, line: 3 } : u))
        );
      }, 1000);
    }, 3500);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(editTimer);
    };
  }, []);

  return (
    <div className="mt-4">
      {/* Code editor with real-time collaboration */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden">
        {/* Editor Header */}
        <div className="bg-zinc-900 border-b border-zinc-800 px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Code2 className="h-3 w-3 text-emerald-500" />
            <span className="text-[10px] text-zinc-500">index.tsx</span>
          </div>
          <div className="flex -space-x-1.5">
            {users.map((user, i) => (
              <div
                key={i}
                className="h-5 w-5 rounded-full border-2 border-zinc-900 flex items-center justify-center text-white text-[9px] font-medium transition-all duration-300"
                style={{ backgroundColor: user.color }}
                title={user.name}
              >
                {user.initial}
              </div>
            ))}
          </div>
        </div>

        {/* Code Content */}
        <div className="p-3 h-28 font-mono text-[10px]">
          {code.map((line, i) => (
            <div key={i} className="flex items-start gap-3 relative group">
              <span className="text-zinc-700 select-none w-4 text-right">
                {i + 1}
              </span>
              <div className="flex-1 relative">
                {/* Line highlight for active editors */}
                {users.some((u) => u.line === i + 1 && u.editing) && (
                  <div className="absolute inset-0 -left-6 right-0 bg-emerald-500/5 border-l-2 border-emerald-500/50" />
                )}
                <span className="relative z-10">
                  <span
                    className={
                      i === 0 || i === code.length - 1
                        ? "text-purple-400"
                        : "text-zinc-300"
                    }
                  >
                    {line}
                  </span>
                  {users.map((user, userIdx) =>
                    user.line === i + 1 && user.editing ? (
                      <span
                        key={userIdx}
                        className="inline-block w-1 h-3 ml-0.5 animate-pulse"
                        style={{ backgroundColor: user.color }}
                      />
                    ) : null
                  )}
                </span>

                {/* User presence indicators */}
                {users.map((user, userIdx) =>
                  user.line === i + 1 && !user.editing ? (
                    <div
                      key={userIdx}
                      className="absolute -left-1 top-0 h-3 w-0.5"
                      style={{ backgroundColor: user.color }}
                    />
                  ) : null
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Status Bar */}
        <div className="bg-zinc-900 border-t border-zinc-800 px-3 py-1 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[9px] text-zinc-500">
              {users.length} collaborator{users.length > 1 ? "s" : ""} online
            </span>
          </div>
          <span className="text-[9px] text-zinc-600">Live</span>
        </div>
      </div>
    </div>
  );
}
