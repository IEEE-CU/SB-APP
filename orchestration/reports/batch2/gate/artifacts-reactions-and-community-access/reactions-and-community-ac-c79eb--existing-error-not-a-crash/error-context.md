# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: reactions-and-community-access.spec.ts >> Community for a non-administrator >> an account without the community permission gets the existing error, not a crash
- Location: tests\session\reactions-and-community-access.spec.ts:174:3

# Error details

```
Test timeout of 90000ms exceeded.
```

# Page snapshot

```yaml
- generic [ref=f2e2]:
  - generic [ref=f2e4]:
    - complementary [ref=f2e5]:
      - navigation [ref=f2e6]:
        - link "Dashboard" [ref=f2e7] [cursor=pointer]:
          - /url: /dashboard
        - link "Societies" [ref=f2e15] [cursor=pointer]:
          - /url: /societies
        - link "Tasks" [ref=f2e22] [cursor=pointer]:
          - /url: /tasks
        - link "Awards & Scholarships" [ref=f2e28] [cursor=pointer]:
          - /url: /opportunities
        - link "Unified Calendar" [ref=f2e34] [cursor=pointer]:
          - /url: /calendar
      - generic [ref=f2e40] [cursor=pointer]:
        - generic [ref=f2e41]: B
        - generic [ref=f2e42]:
          - paragraph [ref=f2e43]: Browser noperm
          - paragraph [ref=f2e44]: guest
    - generic [ref=f2e45]:
      - banner [ref=f2e47]:
        - generic [ref=f2e48]:
          - generic [ref=f2e49]: IEEE
          - generic [ref=f2e50]: Campus Hub
          - button "CS" [ref=f2e53] [cursor=pointer]
        - generic [ref=f2e61]:
          - button "Toggle theme" [ref=f2e62] [cursor=pointer]
          - button "Browser noperm" [ref=f2e65] [cursor=pointer]
          - button "Logout" [ref=f2e71] [cursor=pointer]
      - main [ref=f2e76]:
        - generic [ref=f2e78]:
          - generic [ref=f2e79]:
            - generic [ref=f2e80]:
              - button "Channels" [ref=f2e81] [cursor=pointer]
              - button "Direct Messages" [ref=f2e82] [cursor=pointer]
            - generic [ref=f2e85]:
              - generic [ref=f2e86]: Channels
              - button [ref=f2e87] [cursor=pointer]
          - generic [ref=f2e90]:
            - heading "Welcome to the Community Hub" [level=3] [ref=f2e94]
            - paragraph [ref=f2e95]: Select a channel from the left sidebar or start a direct message to begin communicating with members.
  - generic:
    - status [ref=f2e101]: Failed to load community chat
    - status [ref=f2e107]: Failed to load community chat
```