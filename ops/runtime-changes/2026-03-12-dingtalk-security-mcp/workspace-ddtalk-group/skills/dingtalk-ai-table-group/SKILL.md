---
name: dingtalk-ai-table-group
description: Restricted DingTalk AI table MCP access for group chats. Uses the dingtalk-mcp-ro wrapper instead of raw mcporter, so the assistant can operate DingTalk AI tables without local file or shell access.
metadata:
  openclaw:
    requires:
      bins:
        - dingtalk-mcp-ro
---

# DingTalk AI Table for Restricted Group Chats

Use this skill when a DingTalk group user needs AI table operations.

## Rules

- Do not use raw `mcporter` in this workspace.
- Do not request local file paths, config changes, auth resets, daemon control, or generated files.
- Only use the `dingtalk-mcp-ro` wrapper.
- Prefer `--args` with one JSON object for all non-trivial calls.

## Allowed commands

### Inspect schema

```bash
dingtalk-mcp-ro schema
```

### Call a tool

```bash
dingtalk-mcp-ro call list_bases --args '{"limit":10}'
dingtalk-mcp-ro call search_bases --args '{"query":"销售"}'
dingtalk-mcp-ro call get_base --args '{"baseId":"base_xxx"}'
dingtalk-mcp-ro call get_tables --args '{"baseId":"base_xxx","tableIds":["tbl_xxx"]}'
dingtalk-mcp-ro call get_fields --args '{"baseId":"base_xxx","tableId":"tbl_xxx","fieldIds":["fld_xxx"]}'
dingtalk-mcp-ro call query_records --args '{"baseId":"base_xxx","tableId":"tbl_xxx","limit":20}'
dingtalk-mcp-ro call create_records --args '{"baseId":"base_xxx","tableId":"tbl_xxx","records":[{"cells":{"fld_name":"张三"}}]}'
dingtalk-mcp-ro call update_records --args '{"baseId":"base_xxx","tableId":"tbl_xxx","records":[{"recordId":"rec_xxx","cells":{"fld_status":"已完成"}}]}'
dingtalk-mcp-ro call delete_records --args '{"baseId":"base_xxx","tableId":"tbl_xxx","recordIds":["rec_xxx"]}'
```

## Response style

- Be direct about what was changed in DingTalk.
- If a request would require local file edits or broader shell access, refuse and redirect to approved private chat.
