# API 字段级参考（自动生成）

协议 1.0.0；接口前缀 /v1。字段及示例从 OpenAPI 生成。业务约束、状态码条件和同步流程见 [接口行为](api-behavior.md) 与 [同步协议](sync-protocol.md)。

## POST /v1/admin/auth/login

后台登录。operationId: login；最低角色：public。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|


请求体：LoginInput

~~~json
{
  "username": "示例值",
  "password": "示例值示例值示例值示例值"
}
~~~

成功：HTTP 200，loginResponse。

~~~json
{
  "data": {
    "user": {
      "id": "10000000-0000-4000-8000-000000000001",
      "username": "示例值",
      "display_name": "示例值",
      "role": "admin",
      "status": "active",
      "revision": 0,
      "must_change_password": false
    },
    "csrf_token": "示例值",
    "expires_at": "2026-11-13T02:00:00.000Z"
  },
  "meta": {
    "request_id": "10000000-0000-4000-8000-000000000001",
    "server_time": "2026-11-13T02:00:00.000Z"
  }
}
~~~

错误：400 参数错误；401 凭证失效；403 权限不足；404 不存在；409 冲突；413 超限；422 业务条件不满足；429 限流；503 不可用。统一 ErrorResponse；发生条件及重试动作见 api-behavior.md。

## POST /v1/admin/auth/logout

退出后台。operationId: logout；最低角色：viewer。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| X-CSRF-Token | header | string | true | 当前会话 CSRF token |

成功：HTTP 200，logoutResponse。

~~~json
{
  "data": {
    "ok": false
  },
  "meta": {
    "request_id": "10000000-0000-4000-8000-000000000001",
    "server_time": "2026-11-13T02:00:00.000Z"
  }
}
~~~

错误：400 参数错误；401 凭证失效；403 权限不足；404 不存在；409 冲突；413 超限；422 业务条件不满足；429 限流；503 不可用。统一 ErrorResponse；发生条件及重试动作见 api-behavior.md。

## GET /v1/admin/auth/session

读取会话。operationId: session；最低角色：viewer。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|


成功：HTTP 200，sessionResponse。

~~~json
{
  "data": {
    "user": {
      "id": "10000000-0000-4000-8000-000000000001",
      "username": "示例值",
      "display_name": "示例值",
      "role": "admin",
      "status": "active",
      "revision": 0,
      "must_change_password": false
    },
    "csrf_token": "示例值",
    "expires_at": "2026-11-13T02:00:00.000Z"
  },
  "meta": {
    "request_id": "10000000-0000-4000-8000-000000000001",
    "server_time": "2026-11-13T02:00:00.000Z"
  }
}
~~~

错误：400 参数错误；401 凭证失效；403 权限不足；404 不存在；409 冲突；413 超限；422 业务条件不满足；429 限流；503 不可用。统一 ErrorResponse；发生条件及重试动作见 api-behavior.md。

## POST /v1/admin/auth/change-password

修改密码。operationId: changePassword；最低角色：viewer。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| X-CSRF-Token | header | string | true | 当前会话 CSRF token |

请求体：PasswordInput

~~~json
{
  "current_password": "示例值",
  "new_password": "示例值示例值示例值示例值"
}
~~~

成功：HTTP 200，changePasswordResponse。

~~~json
{
  "data": {
    "ok": false
  },
  "meta": {
    "request_id": "10000000-0000-4000-8000-000000000001",
    "server_time": "2026-11-13T02:00:00.000Z"
  }
}
~~~

错误：400 参数错误；401 凭证失效；403 权限不足；404 不存在；409 冲突；413 超限；422 业务条件不满足；429 限流；503 不可用。统一 ErrorResponse；发生条件及重试动作见 api-behavior.md。

## GET /v1/capabilities

客户端能力发现。operationId: serverCapabilities；最低角色：public。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|


成功：HTTP 200，serverCapabilitiesResponse。

~~~json
{
  "data": {
    "capabilities": []
  },
  "meta": {
    "request_id": "10000000-0000-4000-8000-000000000001",
    "server_time": "2026-11-13T02:00:00.000Z"
  }
}
~~~

错误：400 参数错误；401 凭证失效；403 权限不足；404 不存在；409 冲突；413 超限；422 业务条件不满足；429 限流；503 不可用。统一 ErrorResponse；发生条件及重试动作见 api-behavior.md。

## POST /v1/installations/identity

补报当前安装域身份。operationId: updateIdentity；最低角色：device。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| Idempotency-Key | header | string | true | 一次操作一个键；重试保持不变，24 小时内相同键不同内容为冲突 |

请求体：IdentityUpdate

~~~json
{
  "identity": {
    "account_type": "domain",
    "domain": null,
    "account_name": null,
    "source": "windows_logon"
  }
}
~~~

成功：HTTP 200，updateIdentityResponse。

~~~json
{
  "data": {
    "identity": null,
    "state": "missing",
    "employee_id": null,
    "binding_source": "none"
  },
  "meta": {
    "request_id": "10000000-0000-4000-8000-000000000001",
    "server_time": "2026-11-13T02:00:00.000Z"
  }
}
~~~

错误：400 参数错误；401 凭证失效；403 权限不足；404 不存在；409 冲突；413 超限；422 业务条件不满足；429 限流；503 不可用。统一 ErrorResponse；发生条件及重试动作见 api-behavior.md。

## GET /v1/admin/settings/identity

固定账号自动关联行为（兼容接口）。operationId: getIdentityPolicy；最低角色：admin。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|


成功：HTTP 200，getIdentityPolicyResponse。

~~~json
{
  "data": {
    "version": 0,
    "enabled": false,
    "auto_create": false,
    "rules": []
  },
  "meta": {
    "request_id": "10000000-0000-4000-8000-000000000001",
    "server_time": "2026-11-13T02:00:00.000Z"
  }
}
~~~

错误：400 参数错误；401 凭证失效；403 权限不足；404 不存在；409 冲突；413 超限；422 业务条件不满足；429 限流；503 不可用。统一 ErrorResponse；发生条件及重试动作见 api-behavior.md。

## PATCH /v1/admin/settings/identity

兼容旧版保存请求；返回固定自动关联策略。operationId: updateIdentityPolicy；最低角色：admin。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| Idempotency-Key | header | string | true | 一次操作一个键；重试保持不变，24 小时内相同键不同内容为冲突 |
| X-CSRF-Token | header | string | true | 当前会话 CSRF token |

请求体：IdentityPolicyUpdate

~~~json
{
  "policy": {
    "version": 0,
    "enabled": false,
    "auto_create": false,
    "rules": []
  },
  "expected_revision": 0,
  "reason": "示例值"
}
~~~

成功：HTTP 200，updateIdentityPolicyResponse。

~~~json
{
  "data": {
    "version": 0,
    "enabled": false,
    "auto_create": false,
    "rules": []
  },
  "meta": {
    "request_id": "10000000-0000-4000-8000-000000000001",
    "server_time": "2026-11-13T02:00:00.000Z"
  }
}
~~~

错误：400 参数错误；401 凭证失效；403 权限不足；404 不存在；409 冲突；413 超限；422 业务条件不满足；429 限流；503 不可用。统一 ErrorResponse；发生条件及重试动作见 api-behavior.md。

## POST /v1/installations/register

安装注册。operationId: registerInstallation；最低角色：enrollment。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| X-Piora-Capabilities | header | string | false | 新客户端发送 configurable-sync-interval，声明支持任意正间隔；未声明时下发旧版兼容范围 |
| Idempotency-Key | header | string | true | 一次操作一个键；重试保持不变，24 小时内相同键不同内容为冲突 |

请求体：RegisterInput

~~~json
{
  "registration_id": "10000000-0000-4000-8000-000000000001",
  "installation_id": "10000000-0000-4000-8000-000000000001",
  "credential": {
    "credential_id": "10000000-0000-4000-8000-000000000001",
    "secret": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
  },
  "windows_username": "示例值",
  "device_label": "示例值",
  "app_version": "示例值",
  "sdk_version": "示例值",
  "protocol_version": "1.0",
  "capabilities": []
}
~~~

成功：HTTP 201，registerInstallationResponse。

~~~json
{
  "data": {
    "installation_id": "10000000-0000-4000-8000-000000000001",
    "status": "active",
    "organization_name": "示例值",
    "credential_id": "10000000-0000-4000-8000-000000000001",
    "credential_expires_at": "2026-11-13T02:00:00.000Z",
    "policy": {
      "version": 0,
      "enabled": false,
      "interval_min_seconds": 1500,
      "interval_max_seconds": 2100,
      "initial_delay_min_seconds": 60,
      "initial_delay_max_seconds": 300,
      "reconnect_min_seconds": 120,
      "reconnect_max_seconds": 600,
      "max_batch_events": 500,
      "max_batch_bytes": 262144,
      "queue_max_days": 30,
      "queue_max_bytes": 268435456
    }
  },
  "meta": {
    "request_id": "10000000-0000-4000-8000-000000000001",
    "server_time": "2026-11-13T02:00:00.000Z"
  }
}
~~~

错误：400 参数错误；401 凭证失效；403 权限不足；404 不存在；409 冲突；413 超限；422 业务条件不满足；429 限流；503 不可用。统一 ErrorResponse；发生条件及重试动作见 api-behavior.md。

## POST /v1/installations/credentials/rotate

轮换安装凭证。operationId: rotateCredential；最低角色：device。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| Idempotency-Key | header | string | true | 一次操作一个键；重试保持不变，24 小时内相同键不同内容为冲突 |

请求体：RotateInput

~~~json
{
  "rotation_id": "10000000-0000-4000-8000-000000000001",
  "next_credential": {
    "credential_id": "10000000-0000-4000-8000-000000000001",
    "secret": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
  }
}
~~~

成功：HTTP 200，rotateCredentialResponse。

~~~json
{
  "data": {
    "credential_id": "10000000-0000-4000-8000-000000000001",
    "expires_at": "2026-11-13T02:00:00.000Z",
    "previous_valid_until": "2026-11-13T02:00:00.000Z"
  },
  "meta": {
    "request_id": "10000000-0000-4000-8000-000000000001",
    "server_time": "2026-11-13T02:00:00.000Z"
  }
}
~~~

错误：400 参数错误；401 凭证失效；403 权限不足；404 不存在；409 冲突；413 超限；422 业务条件不满足；429 限流；503 不可用。统一 ErrorResponse；发生条件及重试动作见 api-behavior.md。

## POST /v1/telemetry/batches

批量上报并逐事件确认。operationId: ingestBatch；最低角色：device。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| X-Piora-Capabilities | header | string | false | 新客户端发送 configurable-sync-interval，声明支持任意正间隔；未声明时下发旧版兼容范围 |

请求体：BatchInput

~~~json
{
  "batch_id": "10000000-0000-4000-8000-000000000001",
  "protocol_version": "1.0",
  "client_sent_at": "2026-11-13T02:00:00.000Z",
  "policy_version": 0,
  "events": [
    {
      "event_id": "10000000-0000-4000-8000-000000000001",
      "event_seq": "0",
      "source_key": "示例值",
      "event_type": "desktop.started",
      "occurred_at": "2026-11-13T02:00:00.000Z",
      "app_launch_id": "10000000-0000-4000-8000-000000000001",
      "app_version": "示例值",
      "payload": {
        "reason": "manual"
      }
    }
  ]
}
~~~

成功：HTTP 200，ingestBatchResponse。

~~~json
{
  "data": {
    "accepted_event_ids": [],
    "duplicate_event_ids": [],
    "rejected_events": [],
    "retry_after_seconds": null,
    "policy": null,
    "credential_rotation_due": false
  },
  "meta": {
    "request_id": "10000000-0000-4000-8000-000000000001",
    "server_time": "2026-11-13T02:00:00.000Z"
  }
}
~~~

错误：400 参数错误；401 凭证失效；403 权限不足；404 不存在；409 冲突；413 超限；422 业务条件不满足；429 限流；503 不可用。统一 ErrorResponse；发生条件及重试动作见 api-behavior.md。

## GET /v1/admin/analytics/overview

总览。operationId: reportoverview；最低角色：viewer。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| from | query | string | true | 起始日，包含 |
| to | query | string | true | 结束日，不包含；日汇总最长 731 天，明细限最近 90 天 |
| employee_ids | query | array<string> | false | 重复 query 参数 |
| department_ids | query | array<string> | false | 重复 query 参数 |
| app_versions | query | array<string> | false | 发生时版本 |
| sources | query | array<string> | false | 来源 |

成功：HTTP 200，reportoverviewResponse。

~~~json
{
  "data": {
    "confirmed_employees": "0",
    "active_employees": "0",
    "unconfirmed_installations": "0",
    "metrics": {
      "queries": "0",
      "completed_queries": "0",
      "failed_queries": "0",
      "cancelled_queries": "0",
      "interrupted_queries": "0",
      "pending_queries": "0",
      "opens": "0",
      "launches": "0",
      "runtime_ms": "0",
      "active_ms": "0",
      "task_ms": null,
      "unknown_task_runs": "0",
      "model_calls": "0",
      "input_tokens": null,
      "output_tokens": null,
      "cache_read_tokens": null,
      "cache_write_tokens": null,
      "total_tokens": null,
      "added_lines": "0",
      "deleted_lines": "0",
      "files_created": "0",
      "files_touched": "0",
      "file_operations": "0"
    }
  },
  "meta": {
    "request_id": "10000000-0000-4000-8000-000000000001",
    "server_time": "2026-11-13T02:00:00.000Z",
    "timezone": "Asia/Shanghai",
    "aggregation_as_of": null,
    "from": "2026-11-13",
    "to": "2026-11-13",
    "coverage": {
      "state": "complete",
      "known_model_calls": "0",
      "unknown_model_calls": "0",
      "measured_file_operations": "0",
      "unmeasured_file_operations": "0",
      "last_received_at": null,
      "data_through": null,
      "warning_codes": []
    }
  }
}
~~~

错误：400 参数错误；401 凭证失效；403 权限不足；404 不存在；409 冲突；413 超限；422 业务条件不满足；429 限流；503 不可用。统一 ErrorResponse；发生条件及重试动作见 api-behavior.md。

## GET /v1/admin/analytics/trends

趋势。operationId: reporttrends；最低角色：viewer。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| from | query | string | true | 起始日，包含 |
| to | query | string | true | 结束日，不包含；日汇总最长 731 天，明细限最近 90 天 |
| employee_ids | query | array<string> | false | 重复 query 参数 |
| department_ids | query | array<string> | false | 重复 query 参数 |
| app_versions | query | array<string> | false | 发生时版本 |
| sources | query | array<string> | false | 来源 |
| granularity | query | string | false | v1 仅自然日趋势；默认 day |

成功：HTTP 200，reporttrendsResponse。

~~~json
{
  "data": {
    "items": []
  },
  "meta": {
    "request_id": "10000000-0000-4000-8000-000000000001",
    "server_time": "2026-11-13T02:00:00.000Z",
    "timezone": "Asia/Shanghai",
    "aggregation_as_of": null,
    "from": "2026-11-13",
    "to": "2026-11-13",
    "coverage": {
      "state": "complete",
      "known_model_calls": "0",
      "unknown_model_calls": "0",
      "measured_file_operations": "0",
      "unmeasured_file_operations": "0",
      "last_received_at": null,
      "data_through": null,
      "warning_codes": []
    }
  }
}
~~~

错误：400 参数错误；401 凭证失效；403 权限不足；404 不存在；409 冲突；413 超限；422 业务条件不满足；429 限流；503 不可用。统一 ErrorResponse；发生条件及重试动作见 api-behavior.md。

## GET /v1/admin/analytics/employees/daily

员工每日明细。operationId: reportemployeesdaily；最低角色：viewer。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| from | query | string | true | 起始日，包含 |
| to | query | string | true | 结束日，不包含；日汇总最长 731 天，明细限最近 90 天 |
| employee_ids | query | array<string> | false | 重复 query 参数 |
| department_ids | query | array<string> | false | 重复 query 参数 |
| app_versions | query | array<string> | false | 发生时版本 |
| sources | query | array<string> | false | 来源 |
| limit | query | integer | false | 每页条数 |
| cursor | query | string | false | opaque 游标；与筛选、排序绑定 |
| sort | query | string | false | 稳定排序；同值按 employee_id 和 date 排序 |
| direction | query | string | false | 方向 |

成功：HTTP 200，reportemployeesdailyResponse。

~~~json
{
  "data": {
    "items": [],
    "next_cursor": null,
    "total": "0"
  },
  "meta": {
    "request_id": "10000000-0000-4000-8000-000000000001",
    "server_time": "2026-11-13T02:00:00.000Z",
    "timezone": "Asia/Shanghai",
    "aggregation_as_of": null,
    "from": "2026-11-13",
    "to": "2026-11-13",
    "coverage": {
      "state": "complete",
      "known_model_calls": "0",
      "unknown_model_calls": "0",
      "measured_file_operations": "0",
      "unmeasured_file_operations": "0",
      "last_received_at": null,
      "data_through": null,
      "warning_codes": []
    }
  }
}
~~~

错误：400 参数错误；401 凭证失效；403 权限不足；404 不存在；409 冲突；413 超限；422 业务条件不满足；429 限流；503 不可用。统一 ErrorResponse；发生条件及重试动作见 api-behavior.md。

## GET /v1/admin/analytics/employees/{id}

员工详情。operationId: reportemployeesid；最低角色：viewer。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| from | query | string | true | 起始日，包含 |
| to | query | string | true | 结束日，不包含；日汇总最长 731 天，明细限最近 90 天 |
| employee_ids | query | array<string> | false | 重复 query 参数 |
| department_ids | query | array<string> | false | 重复 query 参数 |
| app_versions | query | array<string> | false | 发生时版本 |
| sources | query | array<string> | false | 来源 |
| id | path | string | true | 资源 ID |

成功：HTTP 200，reportemployeesidResponse。

~~~json
{
  "data": {
    "employee": {
      "id": "10000000-0000-4000-8000-000000000001",
      "name": "示例值",
      "employee_no": null,
      "department_id": null,
      "status": "active",
      "installation_count": 0,
      "revision": 0
    },
    "daily": [],
    "installations": []
  },
  "meta": {
    "request_id": "10000000-0000-4000-8000-000000000001",
    "server_time": "2026-11-13T02:00:00.000Z",
    "timezone": "Asia/Shanghai",
    "aggregation_as_of": null,
    "from": "2026-11-13",
    "to": "2026-11-13",
    "coverage": {
      "state": "complete",
      "known_model_calls": "0",
      "unknown_model_calls": "0",
      "measured_file_operations": "0",
      "unmeasured_file_operations": "0",
      "last_received_at": null,
      "data_through": null,
      "warning_codes": []
    }
  }
}
~~~

错误：400 参数错误；401 凭证失效；403 权限不足；404 不存在；409 冲突；413 超限；422 业务条件不满足；429 限流；503 不可用。统一 ErrorResponse；发生条件及重试动作见 api-behavior.md。

## GET /v1/admin/analytics/queries

请求列表。operationId: reportqueries；最低角色：viewer。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| from | query | string | true | 起始日，包含 |
| to | query | string | true | 结束日，不包含；日汇总最长 731 天，明细限最近 90 天 |
| employee_ids | query | array<string> | false | 重复 query 参数 |
| department_ids | query | array<string> | false | 重复 query 参数 |
| app_versions | query | array<string> | false | 发生时版本 |
| sources | query | array<string> | false | 来源 |
| limit | query | integer | false | 每页条数 |
| cursor | query | string | false | opaque 游标；与筛选、排序绑定 |
| status | query | string | false | 请求状态 |

成功：HTTP 200，reportqueriesResponse。

~~~json
{
  "data": {
    "items": [],
    "next_cursor": null,
    "total": "0"
  },
  "meta": {
    "request_id": "10000000-0000-4000-8000-000000000001",
    "server_time": "2026-11-13T02:00:00.000Z",
    "timezone": "Asia/Shanghai",
    "aggregation_as_of": null,
    "from": "2026-11-13",
    "to": "2026-11-13",
    "coverage": {
      "state": "complete",
      "known_model_calls": "0",
      "unknown_model_calls": "0",
      "measured_file_operations": "0",
      "unmeasured_file_operations": "0",
      "last_received_at": null,
      "data_through": null,
      "warning_codes": []
    }
  }
}
~~~

错误：400 参数错误；401 凭证失效；403 权限不足；404 不存在；409 冲突；413 超限；422 业务条件不满足；429 限流；503 不可用。统一 ErrorResponse；发生条件及重试动作见 api-behavior.md。

## GET /v1/admin/analytics/queries/{id}

请求详情。operationId: reportqueriesid；最低角色：viewer。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| from | query | string | true | 起始日，包含 |
| to | query | string | true | 结束日，不包含；日汇总最长 731 天，明细限最近 90 天 |
| employee_ids | query | array<string> | false | 重复 query 参数 |
| department_ids | query | array<string> | false | 重复 query 参数 |
| app_versions | query | array<string> | false | 发生时版本 |
| sources | query | array<string> | false | 来源 |
| id | path | string | true | 资源 ID |

成功：HTTP 200，reportqueriesidResponse。

~~~json
{
  "data": {
    "query": {
      "id": "10000000-0000-4000-8000-000000000001",
      "installation_id": "10000000-0000-4000-8000-000000000001",
      "employee_id": null,
      "source": "chat",
      "accepted_at": "2026-11-13T02:00:00.000Z",
      "status": "accepted",
      "revision": 0,
      "run_ids": [],
      "metrics": {
        "queries": "0",
        "completed_queries": "0",
        "failed_queries": "0",
        "cancelled_queries": "0",
        "interrupted_queries": "0",
        "pending_queries": "0",
        "opens": "0",
        "launches": "0",
        "runtime_ms": "0",
        "active_ms": "0",
        "task_ms": null,
        "unknown_task_runs": "0",
        "model_calls": "0",
        "input_tokens": null,
        "output_tokens": null,
        "cache_read_tokens": null,
        "cache_write_tokens": null,
        "total_tokens": null,
        "added_lines": "0",
        "deleted_lines": "0",
        "files_created": "0",
        "files_touched": "0",
        "file_operations": "0"
      },
      "coverage": {
        "state": "complete",
        "known_model_calls": "0",
        "unknown_model_calls": "0",
        "measured_file_operations": "0",
        "unmeasured_file_operations": "0",
        "last_received_at": null,
        "data_through": null,
        "warning_codes": []
      }
    },
    "calls": [],
    "file_changes": [],
    "truncated": false
  },
  "meta": {
    "request_id": "10000000-0000-4000-8000-000000000001",
    "server_time": "2026-11-13T02:00:00.000Z",
    "timezone": "Asia/Shanghai",
    "aggregation_as_of": null,
    "from": "2026-11-13",
    "to": "2026-11-13",
    "coverage": {
      "state": "complete",
      "known_model_calls": "0",
      "unknown_model_calls": "0",
      "measured_file_operations": "0",
      "unmeasured_file_operations": "0",
      "last_received_at": null,
      "data_through": null,
      "warning_codes": []
    }
  }
}
~~~

错误：400 参数错误；401 凭证失效；403 权限不足；404 不存在；409 冲突；413 超限；422 业务条件不满足；429 限流；503 不可用。统一 ErrorResponse；发生条件及重试动作见 api-behavior.md。

## GET /v1/admin/analytics/queries/{id}/calls

请求调用分页。operationId: reportqueriesidcalls；最低角色：viewer。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| from | query | string | true | 起始日，包含 |
| to | query | string | true | 结束日，不包含；日汇总最长 731 天，明细限最近 90 天 |
| employee_ids | query | array<string> | false | 重复 query 参数 |
| department_ids | query | array<string> | false | 重复 query 参数 |
| app_versions | query | array<string> | false | 发生时版本 |
| sources | query | array<string> | false | 来源 |
| limit | query | integer | false | 每页条数 |
| cursor | query | string | false | opaque 游标；与筛选、排序绑定 |
| id | path | string | true | 资源 ID |

成功：HTTP 200，reportqueriesidcallsResponse。

~~~json
{
  "data": {
    "items": [],
    "next_cursor": null,
    "total": "0"
  },
  "meta": {
    "request_id": "10000000-0000-4000-8000-000000000001",
    "server_time": "2026-11-13T02:00:00.000Z",
    "timezone": "Asia/Shanghai",
    "aggregation_as_of": null,
    "from": "2026-11-13",
    "to": "2026-11-13",
    "coverage": {
      "state": "complete",
      "known_model_calls": "0",
      "unknown_model_calls": "0",
      "measured_file_operations": "0",
      "unmeasured_file_operations": "0",
      "last_received_at": null,
      "data_through": null,
      "warning_codes": []
    }
  }
}
~~~

错误：400 参数错误；401 凭证失效；403 权限不足；404 不存在；409 冲突；413 超限；422 业务条件不满足；429 限流；503 不可用。统一 ErrorResponse；发生条件及重试动作见 api-behavior.md。

## GET /v1/admin/analytics/queries/{id}/file-changes

请求文件操作分页。operationId: reportqueriesidfilechanges；最低角色：viewer。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| from | query | string | true | 起始日，包含 |
| to | query | string | true | 结束日，不包含；日汇总最长 731 天，明细限最近 90 天 |
| employee_ids | query | array<string> | false | 重复 query 参数 |
| department_ids | query | array<string> | false | 重复 query 参数 |
| app_versions | query | array<string> | false | 发生时版本 |
| sources | query | array<string> | false | 来源 |
| limit | query | integer | false | 每页条数 |
| cursor | query | string | false | opaque 游标；与筛选、排序绑定 |
| id | path | string | true | 资源 ID |

成功：HTTP 200，reportqueriesidfilechangesResponse。

~~~json
{
  "data": {
    "items": [],
    "next_cursor": null,
    "total": "0"
  },
  "meta": {
    "request_id": "10000000-0000-4000-8000-000000000001",
    "server_time": "2026-11-13T02:00:00.000Z",
    "timezone": "Asia/Shanghai",
    "aggregation_as_of": null,
    "from": "2026-11-13",
    "to": "2026-11-13",
    "coverage": {
      "state": "complete",
      "known_model_calls": "0",
      "unknown_model_calls": "0",
      "measured_file_operations": "0",
      "unmeasured_file_operations": "0",
      "last_received_at": null,
      "data_through": null,
      "warning_codes": []
    }
  }
}
~~~

错误：400 参数错误；401 凭证失效；403 权限不足；404 不存在；409 冲突；413 超限；422 业务条件不满足；429 限流；503 不可用。统一 ErrorResponse；发生条件及重试动作见 api-behavior.md。

## GET /v1/admin/analytics/models

模型统计。operationId: reportmodels；最低角色：viewer。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| from | query | string | true | 起始日，包含 |
| to | query | string | true | 结束日，不包含；日汇总最长 731 天，明细限最近 90 天 |
| employee_ids | query | array<string> | false | 重复 query 参数 |
| department_ids | query | array<string> | false | 重复 query 参数 |
| app_versions | query | array<string> | false | 发生时版本 |
| sources | query | array<string> | false | 来源 |

成功：HTTP 200，reportmodelsResponse。

~~~json
{
  "data": {
    "items": []
  },
  "meta": {
    "request_id": "10000000-0000-4000-8000-000000000001",
    "server_time": "2026-11-13T02:00:00.000Z",
    "timezone": "Asia/Shanghai",
    "aggregation_as_of": null,
    "from": "2026-11-13",
    "to": "2026-11-13",
    "coverage": {
      "state": "complete",
      "known_model_calls": "0",
      "unknown_model_calls": "0",
      "measured_file_operations": "0",
      "unmeasured_file_operations": "0",
      "last_received_at": null,
      "data_through": null,
      "warning_codes": []
    }
  }
}
~~~

错误：400 参数错误；401 凭证失效；403 权限不足；404 不存在；409 冲突；413 超限；422 业务条件不满足；429 限流；503 不可用。统一 ErrorResponse；发生条件及重试动作见 api-behavior.md。

## GET /v1/admin/analytics/code

代码统计。operationId: reportcode；最低角色：viewer。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| from | query | string | true | 起始日，包含 |
| to | query | string | true | 结束日，不包含；日汇总最长 731 天，明细限最近 90 天 |
| employee_ids | query | array<string> | false | 重复 query 参数 |
| department_ids | query | array<string> | false | 重复 query 参数 |
| app_versions | query | array<string> | false | 发生时版本 |
| sources | query | array<string> | false | 来源 |

成功：HTTP 200，reportcodeResponse。

~~~json
{
  "data": {
    "items": []
  },
  "meta": {
    "request_id": "10000000-0000-4000-8000-000000000001",
    "server_time": "2026-11-13T02:00:00.000Z",
    "timezone": "Asia/Shanghai",
    "aggregation_as_of": null,
    "from": "2026-11-13",
    "to": "2026-11-13",
    "coverage": {
      "state": "complete",
      "known_model_calls": "0",
      "unknown_model_calls": "0",
      "measured_file_operations": "0",
      "unmeasured_file_operations": "0",
      "last_received_at": null,
      "data_through": null,
      "warning_codes": []
    }
  }
}
~~~

错误：400 参数错误；401 凭证失效；403 权限不足；404 不存在；409 冲突；413 超限；422 业务条件不满足；429 限流；503 不可用。统一 ErrorResponse；发生条件及重试动作见 api-behavior.md。

## GET /v1/admin/analytics/health

采集健康。operationId: reporthealth；最低角色：viewer。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| from | query | string | true | 起始日，包含 |
| to | query | string | true | 结束日，不包含；日汇总最长 731 天，明细限最近 90 天 |
| employee_ids | query | array<string> | false | 重复 query 参数 |
| department_ids | query | array<string> | false | 重复 query 参数 |
| app_versions | query | array<string> | false | 发生时版本 |
| sources | query | array<string> | false | 来源 |

成功：HTTP 200，reporthealthResponse。

~~~json
{
  "data": {
    "installations": [],
    "unbound_count": "0",
    "stale_report_count": "0",
    "rejected_events": "0",
    "aggregation_lag_seconds": 0,
    "warning_codes": []
  },
  "meta": {
    "request_id": "10000000-0000-4000-8000-000000000001",
    "server_time": "2026-11-13T02:00:00.000Z",
    "timezone": "Asia/Shanghai",
    "aggregation_as_of": null,
    "from": "2026-11-13",
    "to": "2026-11-13",
    "coverage": {
      "state": "complete",
      "known_model_calls": "0",
      "unknown_model_calls": "0",
      "measured_file_operations": "0",
      "unmeasured_file_operations": "0",
      "last_received_at": null,
      "data_through": null,
      "warning_codes": []
    }
  }
}
~~~

错误：400 参数错误；401 凭证失效；403 权限不足；404 不存在；409 冲突；413 超限；422 业务条件不满足；429 限流；503 不可用。统一 ErrorResponse；发生条件及重试动作见 api-behavior.md。

## GET /v1/admin/analytics/catalog

筛选选项。operationId: catalog；最低角色：viewer。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|


成功：HTTP 200，catalogResponse。

~~~json
{
  "data": {
    "employees": [],
    "departments": [],
    "app_versions": [],
    "sources": [],
    "languages": []
  },
  "meta": {
    "request_id": "10000000-0000-4000-8000-000000000001",
    "server_time": "2026-11-13T02:00:00.000Z"
  }
}
~~~

错误：400 参数错误；401 凭证失效；403 权限不足；404 不存在；409 冲突；413 超限；422 业务条件不满足；429 限流；503 不可用。统一 ErrorResponse；发生条件及重试动作见 api-behavior.md。

## GET /v1/admin/employees

列表。operationId: listEmployee；最低角色：viewer。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| limit | query | integer | false | 每页条数 |
| cursor | query | string | false | opaque 游标；与筛选、排序绑定 |
| search | query | string | false | 姓名/账号/设备检索 |

成功：HTTP 200，listEmployeeResponse。

~~~json
{
  "data": {
    "items": [],
    "next_cursor": null,
    "total": "0"
  },
  "meta": {
    "request_id": "10000000-0000-4000-8000-000000000001",
    "server_time": "2026-11-13T02:00:00.000Z"
  }
}
~~~

错误：400 参数错误；401 凭证失效；403 权限不足；404 不存在；409 冲突；413 超限；422 业务条件不满足；429 限流；503 不可用。统一 ErrorResponse；发生条件及重试动作见 api-behavior.md。

## POST /v1/admin/employees

创建。operationId: createEmployee；最低角色：admin。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| Idempotency-Key | header | string | true | 一次操作一个键；重试保持不变，24 小时内相同键不同内容为冲突 |
| X-CSRF-Token | header | string | true | 当前会话 CSRF token |

请求体：EmployeeInput

~~~json
{
  "name": "示例值",
  "employee_no": null,
  "department_id": null
}
~~~

成功：HTTP 201，createEmployeeResponse。

~~~json
{
  "data": {
    "id": "10000000-0000-4000-8000-000000000001",
    "name": "示例值",
    "employee_no": null,
    "department_id": null,
    "status": "active",
    "installation_count": 0,
    "revision": 0
  },
  "meta": {
    "request_id": "10000000-0000-4000-8000-000000000001",
    "server_time": "2026-11-13T02:00:00.000Z"
  }
}
~~~

错误：400 参数错误；401 凭证失效；403 权限不足；404 不存在；409 冲突；413 超限；422 业务条件不满足；429 限流；503 不可用。统一 ErrorResponse；发生条件及重试动作见 api-behavior.md。

## PATCH /v1/admin/employees/{id}

修改。operationId: updateEmployee；最低角色：admin。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| id | path | string | true | 资源 ID |
| Idempotency-Key | header | string | true | 一次操作一个键；重试保持不变，24 小时内相同键不同内容为冲突 |
| X-CSRF-Token | header | string | true | 当前会话 CSRF token |

请求体：EmployeeUpdate

~~~json
{
  "name": "示例值",
  "employee_no": null,
  "department_id": null,
  "effective_from": "2026-11-13",
  "expected_revision": 0
}
~~~

成功：HTTP 200，updateEmployeeResponse。

~~~json
{
  "data": {
    "id": "10000000-0000-4000-8000-000000000001",
    "name": "示例值",
    "employee_no": null,
    "department_id": null,
    "status": "active",
    "installation_count": 0,
    "revision": 0
  },
  "meta": {
    "request_id": "10000000-0000-4000-8000-000000000001",
    "server_time": "2026-11-13T02:00:00.000Z"
  }
}
~~~

错误：400 参数错误；401 凭证失效；403 权限不足；404 不存在；409 冲突；413 超限；422 业务条件不满足；429 限流；503 不可用。统一 ErrorResponse；发生条件及重试动作见 api-behavior.md。

## POST /v1/admin/employees/{id}/archive

归档/停用。operationId: archiveEmployee；最低角色：admin。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| id | path | string | true | 资源 ID |
| Idempotency-Key | header | string | true | 一次操作一个键；重试保持不变，24 小时内相同键不同内容为冲突 |
| X-CSRF-Token | header | string | true | 当前会话 CSRF token |

请求体：RevisionInput

~~~json
{
  "expected_revision": 0,
  "reason": "示例值"
}
~~~

成功：HTTP 200，archiveEmployeeResponse。

~~~json
{
  "data": {
    "ok": false
  },
  "meta": {
    "request_id": "10000000-0000-4000-8000-000000000001",
    "server_time": "2026-11-13T02:00:00.000Z"
  }
}
~~~

错误：400 参数错误；401 凭证失效；403 权限不足；404 不存在；409 冲突；413 超限；422 业务条件不满足；429 限流；503 不可用。统一 ErrorResponse；发生条件及重试动作见 api-behavior.md。

## GET /v1/admin/departments

列表。operationId: listDepartment；最低角色：viewer。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| limit | query | integer | false | 每页条数 |
| cursor | query | string | false | opaque 游标；与筛选、排序绑定 |
| search | query | string | false | 姓名/账号/设备检索 |

成功：HTTP 200，listDepartmentResponse。

~~~json
{
  "data": {
    "items": [],
    "next_cursor": null,
    "total": "0"
  },
  "meta": {
    "request_id": "10000000-0000-4000-8000-000000000001",
    "server_time": "2026-11-13T02:00:00.000Z"
  }
}
~~~

错误：400 参数错误；401 凭证失效；403 权限不足；404 不存在；409 冲突；413 超限；422 业务条件不满足；429 限流；503 不可用。统一 ErrorResponse；发生条件及重试动作见 api-behavior.md。

## POST /v1/admin/departments

创建。operationId: createDepartment；最低角色：admin。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| Idempotency-Key | header | string | true | 一次操作一个键；重试保持不变，24 小时内相同键不同内容为冲突 |
| X-CSRF-Token | header | string | true | 当前会话 CSRF token |

请求体：DepartmentInput

~~~json
{
  "name": "示例值"
}
~~~

成功：HTTP 201，createDepartmentResponse。

~~~json
{
  "data": {
    "id": "10000000-0000-4000-8000-000000000001",
    "name": "示例值",
    "status": "active",
    "revision": 0
  },
  "meta": {
    "request_id": "10000000-0000-4000-8000-000000000001",
    "server_time": "2026-11-13T02:00:00.000Z"
  }
}
~~~

错误：400 参数错误；401 凭证失效；403 权限不足；404 不存在；409 冲突；413 超限；422 业务条件不满足；429 限流；503 不可用。统一 ErrorResponse；发生条件及重试动作见 api-behavior.md。

## PATCH /v1/admin/departments/{id}

修改。operationId: updateDepartment；最低角色：admin。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| id | path | string | true | 资源 ID |
| Idempotency-Key | header | string | true | 一次操作一个键；重试保持不变，24 小时内相同键不同内容为冲突 |
| X-CSRF-Token | header | string | true | 当前会话 CSRF token |

请求体：DepartmentUpdate

~~~json
{
  "name": "示例值",
  "expected_revision": 0
}
~~~

成功：HTTP 200，updateDepartmentResponse。

~~~json
{
  "data": {
    "id": "10000000-0000-4000-8000-000000000001",
    "name": "示例值",
    "status": "active",
    "revision": 0
  },
  "meta": {
    "request_id": "10000000-0000-4000-8000-000000000001",
    "server_time": "2026-11-13T02:00:00.000Z"
  }
}
~~~

错误：400 参数错误；401 凭证失效；403 权限不足；404 不存在；409 冲突；413 超限；422 业务条件不满足；429 限流；503 不可用。统一 ErrorResponse；发生条件及重试动作见 api-behavior.md。

## POST /v1/admin/departments/{id}/archive

归档/停用。operationId: archiveDepartment；最低角色：admin。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| id | path | string | true | 资源 ID |
| Idempotency-Key | header | string | true | 一次操作一个键；重试保持不变，24 小时内相同键不同内容为冲突 |
| X-CSRF-Token | header | string | true | 当前会话 CSRF token |

请求体：RevisionInput

~~~json
{
  "expected_revision": 0,
  "reason": "示例值"
}
~~~

成功：HTTP 200，archiveDepartmentResponse。

~~~json
{
  "data": {
    "ok": false
  },
  "meta": {
    "request_id": "10000000-0000-4000-8000-000000000001",
    "server_time": "2026-11-13T02:00:00.000Z"
  }
}
~~~

错误：400 参数错误；401 凭证失效；403 权限不足；404 不存在；409 冲突；413 超限；422 业务条件不满足；429 限流；503 不可用。统一 ErrorResponse；发生条件及重试动作见 api-behavior.md。

## GET /v1/admin/accounts

列表。operationId: listAdminUser；最低角色：admin。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| limit | query | integer | false | 每页条数 |
| cursor | query | string | false | opaque 游标；与筛选、排序绑定 |
| search | query | string | false | 姓名/账号/设备检索 |

成功：HTTP 200，listAdminUserResponse。

~~~json
{
  "data": {
    "items": [],
    "next_cursor": null,
    "total": "0"
  },
  "meta": {
    "request_id": "10000000-0000-4000-8000-000000000001",
    "server_time": "2026-11-13T02:00:00.000Z"
  }
}
~~~

错误：400 参数错误；401 凭证失效；403 权限不足；404 不存在；409 冲突；413 超限；422 业务条件不满足；429 限流；503 不可用。统一 ErrorResponse；发生条件及重试动作见 api-behavior.md。

## POST /v1/admin/accounts

创建。operationId: createAdminUser；最低角色：admin。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| Idempotency-Key | header | string | true | 一次操作一个键；重试保持不变，24 小时内相同键不同内容为冲突 |
| X-CSRF-Token | header | string | true | 当前会话 CSRF token |

请求体：AdminCreate

~~~json
{
  "username": "示例值",
  "display_name": "示例值",
  "role": "admin",
  "temporary_password": "示例值示例值示例值示例值"
}
~~~

成功：HTTP 201，createAdminUserResponse。

~~~json
{
  "data": {
    "id": "10000000-0000-4000-8000-000000000001",
    "username": "示例值",
    "display_name": "示例值",
    "role": "admin",
    "status": "active",
    "revision": 0,
    "must_change_password": false
  },
  "meta": {
    "request_id": "10000000-0000-4000-8000-000000000001",
    "server_time": "2026-11-13T02:00:00.000Z"
  }
}
~~~

错误：400 参数错误；401 凭证失效；403 权限不足；404 不存在；409 冲突；413 超限；422 业务条件不满足；429 限流；503 不可用。统一 ErrorResponse；发生条件及重试动作见 api-behavior.md。

## PATCH /v1/admin/accounts/{id}

修改。operationId: updateAdminUser；最低角色：admin。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| id | path | string | true | 资源 ID |
| Idempotency-Key | header | string | true | 一次操作一个键；重试保持不变，24 小时内相同键不同内容为冲突 |
| X-CSRF-Token | header | string | true | 当前会话 CSRF token |

请求体：AdminUpdate

~~~json
{
  "display_name": "示例值",
  "role": "admin",
  "status": "active",
  "expected_revision": 0
}
~~~

成功：HTTP 200，updateAdminUserResponse。

~~~json
{
  "data": {
    "id": "10000000-0000-4000-8000-000000000001",
    "username": "示例值",
    "display_name": "示例值",
    "role": "admin",
    "status": "active",
    "revision": 0,
    "must_change_password": false
  },
  "meta": {
    "request_id": "10000000-0000-4000-8000-000000000001",
    "server_time": "2026-11-13T02:00:00.000Z"
  }
}
~~~

错误：400 参数错误；401 凭证失效；403 权限不足；404 不存在；409 冲突；413 超限；422 业务条件不满足；429 限流；503 不可用。统一 ErrorResponse；发生条件及重试动作见 api-behavior.md。

## POST /v1/admin/accounts/{id}/archive

归档/停用。operationId: archiveAdminUser；最低角色：admin。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| id | path | string | true | 资源 ID |
| Idempotency-Key | header | string | true | 一次操作一个键；重试保持不变，24 小时内相同键不同内容为冲突 |
| X-CSRF-Token | header | string | true | 当前会话 CSRF token |

请求体：RevisionInput

~~~json
{
  "expected_revision": 0,
  "reason": "示例值"
}
~~~

成功：HTTP 200，archiveAdminUserResponse。

~~~json
{
  "data": {
    "ok": false
  },
  "meta": {
    "request_id": "10000000-0000-4000-8000-000000000001",
    "server_time": "2026-11-13T02:00:00.000Z"
  }
}
~~~

错误：400 参数错误；401 凭证失效；403 权限不足；404 不存在；409 冲突；413 超限；422 业务条件不满足；429 限流；503 不可用。统一 ErrorResponse；发生条件及重试动作见 api-behavior.md。

## POST /v1/admin/accounts/{id}/revoke-sessions

撤销后台会话。operationId: revokeSessions；最低角色：admin。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| id | path | string | true | 资源 ID |
| Idempotency-Key | header | string | true | 一次操作一个键；重试保持不变，24 小时内相同键不同内容为冲突 |
| X-CSRF-Token | header | string | true | 当前会话 CSRF token |

请求体：RevisionInput

~~~json
{
  "expected_revision": 0,
  "reason": "示例值"
}
~~~

成功：HTTP 200，revokeSessionsResponse。

~~~json
{
  "data": {
    "ok": false
  },
  "meta": {
    "request_id": "10000000-0000-4000-8000-000000000001",
    "server_time": "2026-11-13T02:00:00.000Z"
  }
}
~~~

错误：400 参数错误；401 凭证失效；403 权限不足；404 不存在；409 冲突；413 超限；422 业务条件不满足；429 限流；503 不可用。统一 ErrorResponse；发生条件及重试动作见 api-behavior.md。

## GET /v1/admin/installations

安装列表。operationId: listInstallations；最低角色：viewer。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| limit | query | integer | false | 每页条数 |
| cursor | query | string | false | opaque 游标；与筛选、排序绑定 |
| search | query | string | false | 姓名/账号/设备检索 |

成功：HTTP 200，listInstallationsResponse。

~~~json
{
  "data": {
    "items": [],
    "next_cursor": null,
    "total": "0"
  },
  "meta": {
    "request_id": "10000000-0000-4000-8000-000000000001",
    "server_time": "2026-11-13T02:00:00.000Z"
  }
}
~~~

错误：400 参数错误；401 凭证失效；403 权限不足；404 不存在；409 冲突；413 超限；422 业务条件不满足；429 限流；503 不可用。统一 ErrorResponse；发生条件及重试动作见 api-behavior.md。

## GET /v1/admin/installations/{id}

安装详情。operationId: getInstallation；最低角色：viewer。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| id | path | string | true | 资源 ID |

成功：HTTP 200，getInstallationResponse。

~~~json
{
  "data": {
    "id": "10000000-0000-4000-8000-000000000001",
    "windows_username": "示例值",
    "device_label": "示例值",
    "employee_id": null,
    "app_version": "示例值",
    "status": "active",
    "last_received_at": null,
    "last_event_at": null,
    "reported_queue_events": "0",
    "coverage": {
      "state": "complete",
      "known_model_calls": "0",
      "unknown_model_calls": "0",
      "measured_file_operations": "0",
      "unmeasured_file_operations": "0",
      "last_received_at": null,
      "data_through": null,
      "warning_codes": []
    },
    "revision": 0
  },
  "meta": {
    "request_id": "10000000-0000-4000-8000-000000000001",
    "server_time": "2026-11-13T02:00:00.000Z"
  }
}
~~~

错误：400 参数错误；401 凭证失效；403 权限不足；404 不存在；409 冲突；413 超限；422 业务条件不满足；429 限流；503 不可用。统一 ErrorResponse；发生条件及重试动作见 api-behavior.md。

## GET /v1/admin/installations/{id}/bindings

绑定历史。operationId: listBindings；最低角色：admin。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| limit | query | integer | false | 每页条数 |
| cursor | query | string | false | opaque 游标；与筛选、排序绑定 |
| id | path | string | true | 资源 ID |

成功：HTTP 200，listBindingsResponse。

~~~json
{
  "data": {
    "items": [],
    "next_cursor": null,
    "total": "0"
  },
  "meta": {
    "request_id": "10000000-0000-4000-8000-000000000001",
    "server_time": "2026-11-13T02:00:00.000Z"
  }
}
~~~

错误：400 参数错误；401 凭证失效；403 权限不足；404 不存在；409 冲突；413 超限；422 业务条件不满足；429 限流；503 不可用。统一 ErrorResponse；发生条件及重试动作见 api-behavior.md。

## POST /v1/admin/installations/{id}/bindings

绑定员工。operationId: createBinding；最低角色：admin。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| id | path | string | true | 资源 ID |
| Idempotency-Key | header | string | true | 一次操作一个键；重试保持不变，24 小时内相同键不同内容为冲突 |
| X-CSRF-Token | header | string | true | 当前会话 CSRF token |

请求体：BindingInput

~~~json
{
  "employee_id": "10000000-0000-4000-8000-000000000001",
  "valid_from": null,
  "valid_to": null,
  "reason": "示例值",
  "expected_revision": 0
}
~~~

成功：HTTP 201，createBindingResponse。

~~~json
{
  "data": {
    "id": "10000000-0000-4000-8000-000000000001",
    "installation_id": "10000000-0000-4000-8000-000000000001",
    "employee_id": "10000000-0000-4000-8000-000000000001",
    "valid_from": null,
    "valid_to": null,
    "reason": "示例值",
    "revision": 0
  },
  "meta": {
    "request_id": "10000000-0000-4000-8000-000000000001",
    "server_time": "2026-11-13T02:00:00.000Z"
  }
}
~~~

错误：400 参数错误；401 凭证失效；403 权限不足；404 不存在；409 冲突；413 超限；422 业务条件不满足；429 限流；503 不可用。统一 ErrorResponse；发生条件及重试动作见 api-behavior.md。

## PATCH /v1/admin/bindings/{id}

纠正绑定。operationId: correctBinding；最低角色：admin。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| id | path | string | true | 资源 ID |
| Idempotency-Key | header | string | true | 一次操作一个键；重试保持不变，24 小时内相同键不同内容为冲突 |
| X-CSRF-Token | header | string | true | 当前会话 CSRF token |

请求体：BindingInput

~~~json
{
  "employee_id": "10000000-0000-4000-8000-000000000001",
  "valid_from": null,
  "valid_to": null,
  "reason": "示例值",
  "expected_revision": 0
}
~~~

成功：HTTP 200，correctBindingResponse。

~~~json
{
  "data": {
    "id": "10000000-0000-4000-8000-000000000001",
    "installation_id": "10000000-0000-4000-8000-000000000001",
    "employee_id": "10000000-0000-4000-8000-000000000001",
    "valid_from": null,
    "valid_to": null,
    "reason": "示例值",
    "revision": 0
  },
  "meta": {
    "request_id": "10000000-0000-4000-8000-000000000001",
    "server_time": "2026-11-13T02:00:00.000Z"
  }
}
~~~

错误：400 参数错误；401 凭证失效；403 权限不足；404 不存在；409 冲突；413 超限；422 业务条件不满足；429 限流；503 不可用。统一 ErrorResponse；发生条件及重试动作见 api-behavior.md。

## POST /v1/admin/installations/{id}/revoke

撤销安装上报权限。operationId: revokeInstallation；最低角色：admin。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| id | path | string | true | 资源 ID |
| Idempotency-Key | header | string | true | 一次操作一个键；重试保持不变，24 小时内相同键不同内容为冲突 |
| X-CSRF-Token | header | string | true | 当前会话 CSRF token |

请求体：RevisionInput

~~~json
{
  "expected_revision": 0,
  "reason": "示例值"
}
~~~

成功：HTTP 200，revokeInstallationResponse。

~~~json
{
  "data": {
    "ok": false
  },
  "meta": {
    "request_id": "10000000-0000-4000-8000-000000000001",
    "server_time": "2026-11-13T02:00:00.000Z"
  }
}
~~~

错误：400 参数错误；401 凭证失效；403 权限不足；404 不存在；409 冲突；413 超限；422 业务条件不满足；429 限流；503 不可用。统一 ErrorResponse；发生条件及重试动作见 api-behavior.md。

## GET /v1/admin/enrollment-keys

注册凭证列表。operationId: listEnrollment；最低角色：admin。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| limit | query | integer | false | 每页条数 |
| cursor | query | string | false | opaque 游标；与筛选、排序绑定 |
| search | query | string | false | 用途名称包含匹配，不区分大小写；空白忽略 |

成功：HTTP 200，listEnrollmentResponse。

~~~json
{
  "data": {
    "items": [],
    "next_cursor": null,
    "total": "0"
  },
  "meta": {
    "request_id": "10000000-0000-4000-8000-000000000001",
    "server_time": "2026-11-13T02:00:00.000Z"
  }
}
~~~

错误：400 参数错误；401 凭证失效；403 权限不足；404 不存在；409 冲突；413 超限；422 业务条件不满足；429 限流；503 不可用。统一 ErrorResponse；发生条件及重试动作见 api-behavior.md。

## POST /v1/admin/enrollment-keys

创建注册凭证。operationId: createEnrollment；最低角色：admin。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| Idempotency-Key | header | string | true | 一次操作一个键；重试保持不变，24 小时内相同键不同内容为冲突 |
| X-CSRF-Token | header | string | true | 当前会话 CSRF token |

请求体：EnrollmentInput

~~~json
{
  "label": "示例值",
  "expires_at": "2026-11-13T02:00:00.000Z",
  "max_registrations": 1
}
~~~

成功：HTTP 201，createEnrollmentResponse。

~~~json
{
  "data": {
    "key": {
      "id": "10000000-0000-4000-8000-000000000001",
      "label": "示例值",
      "expires_at": "2026-11-13T02:00:00.000Z",
      "max_registrations": 1,
      "used_registrations": 0,
      "revoked_at": null,
      "revision": 0
    },
    "secret": "示例值"
  },
  "meta": {
    "request_id": "10000000-0000-4000-8000-000000000001",
    "server_time": "2026-11-13T02:00:00.000Z"
  }
}
~~~

错误：400 参数错误；401 凭证失效；403 权限不足；404 不存在；409 冲突；413 超限；422 业务条件不满足；429 限流；503 不可用。统一 ErrorResponse；发生条件及重试动作见 api-behavior.md。

## POST /v1/admin/enrollment-keys/{id}/revoke

撤销注册凭证。operationId: revokeEnrollment；最低角色：admin。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| id | path | string | true | 资源 ID |
| Idempotency-Key | header | string | true | 一次操作一个键；重试保持不变，24 小时内相同键不同内容为冲突 |
| X-CSRF-Token | header | string | true | 当前会话 CSRF token |

请求体：RevisionInput

~~~json
{
  "expected_revision": 0,
  "reason": "示例值"
}
~~~

成功：HTTP 200，revokeEnrollmentResponse。

~~~json
{
  "data": {
    "ok": false
  },
  "meta": {
    "request_id": "10000000-0000-4000-8000-000000000001",
    "server_time": "2026-11-13T02:00:00.000Z"
  }
}
~~~

错误：400 参数错误；401 凭证失效；403 权限不足；404 不存在；409 冲突；413 超限；422 业务条件不满足；429 限流；503 不可用。统一 ErrorResponse；发生条件及重试动作见 api-behavior.md。

## GET /v1/admin/settings/sync

同步策略。operationId: getSync；最低角色：admin。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|


成功：HTTP 200，getSyncResponse。

~~~json
{
  "data": {
    "version": 0,
    "enabled": false,
    "interval_min_seconds": 1500,
    "interval_max_seconds": 2100,
    "initial_delay_min_seconds": 60,
    "initial_delay_max_seconds": 300,
    "reconnect_min_seconds": 120,
    "reconnect_max_seconds": 600,
    "max_batch_events": 500,
    "max_batch_bytes": 262144,
    "queue_max_days": 30,
    "queue_max_bytes": 268435456
  },
  "meta": {
    "request_id": "10000000-0000-4000-8000-000000000001",
    "server_time": "2026-11-13T02:00:00.000Z"
  }
}
~~~

错误：400 参数错误；401 凭证失效；403 权限不足；404 不存在；409 冲突；413 超限；422 业务条件不满足；429 限流；503 不可用。统一 ErrorResponse；发生条件及重试动作见 api-behavior.md。

## PATCH /v1/admin/settings/sync

更新同步策略。operationId: updateSync；最低角色：admin。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| Idempotency-Key | header | string | true | 一次操作一个键；重试保持不变，24 小时内相同键不同内容为冲突 |
| X-CSRF-Token | header | string | true | 当前会话 CSRF token |

请求体：PolicyUpdate

~~~json
{
  "policy": {
    "version": 0,
    "enabled": false,
    "interval_min_seconds": 1500,
    "interval_max_seconds": 2100,
    "initial_delay_min_seconds": 60,
    "initial_delay_max_seconds": 300,
    "reconnect_min_seconds": 120,
    "reconnect_max_seconds": 600,
    "max_batch_events": 500,
    "max_batch_bytes": 262144,
    "queue_max_days": 30,
    "queue_max_bytes": 268435456
  },
  "expected_revision": 0,
  "reason": "示例值"
}
~~~

成功：HTTP 200，updateSyncResponse。

~~~json
{
  "data": {
    "version": 0,
    "enabled": false,
    "interval_min_seconds": 1500,
    "interval_max_seconds": 2100,
    "initial_delay_min_seconds": 60,
    "initial_delay_max_seconds": 300,
    "reconnect_min_seconds": 120,
    "reconnect_max_seconds": 600,
    "max_batch_events": 500,
    "max_batch_bytes": 262144,
    "queue_max_days": 30,
    "queue_max_bytes": 268435456
  },
  "meta": {
    "request_id": "10000000-0000-4000-8000-000000000001",
    "server_time": "2026-11-13T02:00:00.000Z"
  }
}
~~~

错误：400 参数错误；401 凭证失效；403 权限不足；404 不存在；409 冲突；413 超限；422 业务条件不满足；429 限流；503 不可用。统一 ErrorResponse；发生条件及重试动作见 api-behavior.md。

## GET /v1/admin/settings/retention

保留策略。operationId: getRetention；最低角色：admin。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|


成功：HTTP 200，getRetentionResponse。

~~~json
{
  "data": {
    "raw_days": 90,
    "daily_months": 24,
    "audit_days": 365,
    "revision": 0
  },
  "meta": {
    "request_id": "10000000-0000-4000-8000-000000000001",
    "server_time": "2026-11-13T02:00:00.000Z"
  }
}
~~~

错误：400 参数错误；401 凭证失效；403 权限不足；404 不存在；409 冲突；413 超限；422 业务条件不满足；429 限流；503 不可用。统一 ErrorResponse；发生条件及重试动作见 api-behavior.md。

## PATCH /v1/admin/settings/retention

更新保留策略。operationId: updateRetention；最低角色：admin。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| Idempotency-Key | header | string | true | 一次操作一个键；重试保持不变，24 小时内相同键不同内容为冲突 |
| X-CSRF-Token | header | string | true | 当前会话 CSRF token |

请求体：RetentionUpdate

~~~json
{
  "policy": {
    "raw_days": 90,
    "daily_months": 24,
    "audit_days": 365,
    "revision": 0
  },
  "expected_revision": 0,
  "reason": "示例值"
}
~~~

成功：HTTP 200，updateRetentionResponse。

~~~json
{
  "data": {
    "raw_days": 90,
    "daily_months": 24,
    "audit_days": 365,
    "revision": 0
  },
  "meta": {
    "request_id": "10000000-0000-4000-8000-000000000001",
    "server_time": "2026-11-13T02:00:00.000Z"
  }
}
~~~

错误：400 参数错误；401 凭证失效；403 权限不足；404 不存在；409 冲突；413 超限；422 业务条件不满足；429 限流；503 不可用。统一 ErrorResponse；发生条件及重试动作见 api-behavior.md。

## GET /v1/admin/audit-logs

审计日志。operationId: listAudit；最低角色：admin。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| from | query | string | true | 起始日，包含 |
| to | query | string | true | 结束日，不包含；日汇总最长 731 天，明细限最近 90 天 |
| limit | query | integer | false | 每页条数 |
| cursor | query | string | false | opaque 游标；与筛选、排序绑定 |

成功：HTTP 200，listAuditResponse。

~~~json
{
  "data": {
    "items": [],
    "next_cursor": null,
    "total": "0"
  },
  "meta": {
    "request_id": "10000000-0000-4000-8000-000000000001",
    "server_time": "2026-11-13T02:00:00.000Z"
  }
}
~~~

错误：400 参数错误；401 凭证失效；403 权限不足；404 不存在；409 冲突；413 超限；422 业务条件不满足；429 限流；503 不可用。统一 ErrorResponse；发生条件及重试动作见 api-behavior.md。

## POST /v1/admin/exports

创建导出任务。operationId: createExport；最低角色：viewer。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| Idempotency-Key | header | string | true | 一次操作一个键；重试保持不变，24 小时内相同键不同内容为冲突 |
| X-CSRF-Token | header | string | true | 当前会话 CSRF token |

请求体：ExportInput

~~~json
{
  "kind": "employee_daily",
  "from": "2026-11-13",
  "to": "2026-11-13",
  "employee_ids": [],
  "department_ids": [],
  "app_versions": []
}
~~~

成功：HTTP 202，createExportResponse。

~~~json
{
  "data": {
    "id": "10000000-0000-4000-8000-000000000001",
    "status": "queued",
    "created_at": "2026-11-13T02:00:00.000Z",
    "row_count": null,
    "expires_at": "2026-11-13T02:00:00.000Z",
    "download_path": null,
    "error_code": null
  },
  "meta": {
    "request_id": "10000000-0000-4000-8000-000000000001",
    "server_time": "2026-11-13T02:00:00.000Z"
  }
}
~~~

错误：400 参数错误；401 凭证失效；403 权限不足；404 不存在；409 冲突；413 超限；422 业务条件不满足；429 限流；503 不可用。统一 ErrorResponse；发生条件及重试动作见 api-behavior.md。

## GET /v1/admin/exports/{id}

导出状态。operationId: getExport；最低角色：viewer。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| id | path | string | true | 资源 ID |

成功：HTTP 200，getExportResponse。

~~~json
{
  "data": {
    "id": "10000000-0000-4000-8000-000000000001",
    "status": "queued",
    "created_at": "2026-11-13T02:00:00.000Z",
    "row_count": null,
    "expires_at": "2026-11-13T02:00:00.000Z",
    "download_path": null,
    "error_code": null
  },
  "meta": {
    "request_id": "10000000-0000-4000-8000-000000000001",
    "server_time": "2026-11-13T02:00:00.000Z"
  }
}
~~~

错误：400 参数错误；401 凭证失效；403 权限不足；404 不存在；409 冲突；413 超限；422 业务条件不满足；429 限流；503 不可用。统一 ErrorResponse；发生条件及重试动作见 api-behavior.md。

## GET /v1/admin/exports/{id}/download

下载 CSV。operationId: downloadExport；最低角色：viewer。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| id | path | string | true | 资源 ID |

成功：HTTP 200，UTF-8 BOM CSV。

错误：400 参数错误；401 凭证失效；403 权限不足；404 不存在；409 冲突；413 超限；422 业务条件不满足；429 限流；503 不可用。统一 ErrorResponse；发生条件及重试动作见 api-behavior.md。

## GET /health/live

进程存活。operationId: liveness；最低角色：public。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|


成功：HTTP 200，livenessResponse。

~~~json
{
  "data": {
    "status": "ok"
  },
  "meta": {
    "request_id": "10000000-0000-4000-8000-000000000001",
    "server_time": "2026-11-13T02:00:00.000Z"
  }
}
~~~

错误：400 参数错误；401 凭证失效；403 权限不足；404 不存在；409 冲突；413 超限；422 业务条件不满足；429 限流；503 不可用。统一 ErrorResponse；发生条件及重试动作见 api-behavior.md。

## GET /health/ready

数据库初始化就绪。operationId: readiness；最低角色：public。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|---|---|---|---|---|


成功：HTTP 200，readinessResponse。

~~~json
{
  "data": {
    "status": "ok"
  },
  "meta": {
    "request_id": "10000000-0000-4000-8000-000000000001",
    "server_time": "2026-11-13T02:00:00.000Z"
  }
}
~~~

错误：400 参数错误；401 凭证失效；403 权限不足；404 不存在；409 冲突；413 超限；422 业务条件不满足；429 限流；503 不可用。统一 ErrorResponse；发生条件及重试动作见 api-behavior.md。

# 数据对象字段字典

所有对象禁止额外字段。引用对象在本节完整展开；响应不回传 writeOnly 字段。

## ErrorBody

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| code | string | true | {"minLength":1,"maxLength":64} | 稳定机器错误码 |
| message | string | true | {"minLength":1,"maxLength":512} | 安全错误信息，不含密钥或对话 |
| retryable | boolean | true | {} | 是否可按协议自动重试 |
| request_id | string | true | {"format":"uuid"} | 稳定 UUID，不能使用用户名代替 |
| field_errors | array<object> | true | {"maxItems":100} | 逐字段错误 |

## ErrorResponse

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| error | ErrorBody | true | {} | 见引用对象 |

## Meta

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| request_id | string | true | {"format":"uuid"} | 稳定 UUID，不能使用用户名代替 |
| server_time | string | true | {"format":"date-time"} | 服务端响应时间 |

## Coverage

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| state | string | true | {"enum":["complete","partial","unknown","no_reports","not_enrolled","out_of_retention"]} | 数据状态；与在线状态无关 |
| known_model_calls | string | true | {"maxLength":19,"pattern":"^(0/[1-9][0-9]*)$"} | 有用量的调用；非负 int64 十进制字符串，最大 9223372036854775807 |
| unknown_model_calls | string | true | {"maxLength":19,"pattern":"^(0/[1-9][0-9]*)$"} | 无可靠用量的调用；非负 int64 十进制字符串，最大 9223372036854775807 |
| measured_file_operations | string | true | {"maxLength":19,"pattern":"^(0/[1-9][0-9]*)$"} | 可靠计量文件操作；非负 int64 十进制字符串，最大 9223372036854775807 |
| unmeasured_file_operations | string | true | {"maxLength":19,"pattern":"^(0/[1-9][0-9]*)$"} | 未计量文件操作；非负 int64 十进制字符串，最大 9223372036854775807 |
| last_received_at | string / null | true | {} | 最近收到事件时间 |
| data_through | string / null | true | {} | 最近已处理的实际事件时间 |
| warning_codes | array<string> | true | {"maxItems":30} | 质量提示 |

## ReportMeta

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| request_id | string | true | {"format":"uuid"} | 稳定 UUID，不能使用用户名代替 |
| server_time | string | true | {"format":"date-time"} | 响应时间 |
| timezone | string | true | {"enum":["Asia/Shanghai"]} | 固定统计时区 |
| aggregation_as_of | string / null | true | {} | 当前聚合完成时间 |
| from | string | true | {"format":"date"} | 统计起始日，包含 |
| to | string | true | {"format":"date"} | 统计结束日，不包含 |
| coverage | Coverage | true | {} | 见引用对象 |

## SyncPolicy

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| version | integer | true | {"minimum":0,"maximum":1000000} | 策略版本 |
| enabled | boolean | true | {} | 组织采集是否启用 |
| interval_min_seconds | integer | true | {"minimum":1,"default":1500} | 正常同步最小间隔，正整数秒；后台可设置任意正整数分钟 |
| interval_max_seconds | integer | true | {"minimum":1,"default":2100} | 正常同步最大间隔，不小于最小间隔；不设业务时间上限 |
| initial_delay_min_seconds | integer | true | {"minimum":0,"maximum":600,"default":60} | 首次/逾期启动最小抖动 |
| initial_delay_max_seconds | integer | true | {"minimum":0,"maximum":600,"default":300} | 首次/逾期启动最大抖动 |
| reconnect_min_seconds | integer | true | {"minimum":0,"maximum":1800,"default":120} | 网络恢复最小抖动 |
| reconnect_max_seconds | integer | true | {"minimum":0,"maximum":1800,"default":600} | 网络恢复最大抖动 |
| max_batch_events | integer | true | {"minimum":1,"maximum":500,"default":500} | 每批事件上限 |
| max_batch_bytes | integer | true | {"minimum":4096,"maximum":262144,"default":262144} | 未压缩 JSON 字节上限 |
| queue_max_days | integer | true | {"minimum":1,"maximum":30,"default":30} | 本地保留天数 |
| queue_max_bytes | integer | true | {"minimum":1048576,"maximum":268435456,"default":268435456} | 本地队列字节上限 |

## AdminUser

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| id | string | true | {"format":"uuid"} | 稳定 UUID，不能使用用户名代替 |
| username | string | true | {"minLength":1,"maxLength":80} | 后台账号，组织内唯一 |
| display_name | string | true | {"minLength":1,"maxLength":120} | 显示名 |
| role | string | true | {"enum":["admin","viewer"]} | 服务端权限角色 |
| status | string | true | {"enum":["active","disabled"]} | 账号状态 |
| revision | integer | true | {"minimum":0,"maximum":2147483647} | 乐观锁版本 |
| must_change_password | boolean | true | {} | 是否必须修改临时密码 |

## LoginInput

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| username | string | true | {"minLength":1,"maxLength":80} | 后台账号 |
| password | string | true | {"minLength":12,"maxLength":256,"writeOnly":true} | 密码，仅通过 TLS 提交，禁止记录日志 |

## Session

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| user | AdminUser | true | {} | 见引用对象 |
| csrf_token | string | true | {"minLength":1,"maxLength":128} | 用于管理写请求的 CSRF 值 |
| expires_at | string | true | {"format":"date-time"} | 绝对过期时间；12 小时，空闲 2 小时失效 |

## PasswordInput

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| current_password | string | true | {"minLength":1,"maxLength":256,"writeOnly":true} | 当前密码 |
| new_password | string | true | {"minLength":12,"maxLength":256,"writeOnly":true} | 新密码 |

## Ok

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| ok | boolean | true | {} | 操作成功 |

## Department

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| id | string | true | {"format":"uuid"} | 稳定 UUID，不能使用用户名代替 |
| name | string | true | {"minLength":1,"maxLength":120} | 部门名称，组织内唯一 |
| status | string | true | {"enum":["active","archived"]} | 状态 |
| revision | integer | true | {"minimum":0,"maximum":2147483647} | 版本 |

## DepartmentInput

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| name | string | true | {"minLength":1,"maxLength":120} | 部门名称 |

## DepartmentUpdate

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| name | string | true | {"minLength":1,"maxLength":120} | 部门名称 |
| expected_revision | integer | true | {"minimum":0,"maximum":2147483647} | 提交时看到的版本 |

## Employee

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| id | string | true | {"format":"uuid"} | 稳定 UUID，不能使用用户名代替 |
| name | string | true | {"minLength":1,"maxLength":120} | 员工显示名，允许重名 |
| employee_no | string / null | true | {} | 可选工号；非空时组织内唯一 |
| department_id | string / null | true | {} | 当前部门 |
| status | string | true | {"enum":["active","archived"]} | 状态 |
| installation_count | integer | true | {"minimum":0,"maximum":2147483647} | 绑定安装实例数量 |
| revision | integer | true | {"minimum":0,"maximum":2147483647} | 版本 |

## EmployeeInput

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| name | string | true | {"minLength":1,"maxLength":120} | 员工显示名 |
| employee_no | string / null | true | {} | 工号 |
| department_id | string / null | true | {} | 部门 ID |

## EmployeeUpdate

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| name | string | true | {"minLength":1,"maxLength":120} | 员工显示名 |
| employee_no | string / null | true | {} | 工号 |
| department_id | string / null | true | {} | 部门 ID |
| effective_from | string | true | {"format":"date"} | 部门调整生效日；北京时间 |
| expected_revision | integer | true | {"minimum":0,"maximum":2147483647} | 版本 |

## RevisionInput

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| expected_revision | integer | true | {"minimum":0,"maximum":2147483647} | 版本 |
| reason | string | true | {"minLength":1,"maxLength":500} | 操作原因 |

## CredentialMaterial

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| credential_id | string | true | {"format":"uuid"} | 稳定 UUID，不能使用用户名代替 |
| secret | string | true | {"minLength":43,"maxLength":43,"pattern":"^[A-Za-z0-9_-]{43}$","writeOnly":true} | 客户端生成的 32 随机字节 base64url；注册前使用 DPAPI 保存；仅认证接口可携带 |

## WindowsIdentity

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| account_type | string | true | {"enum":["domain","local","unknown"]} | 客户端报告的账号类型，不是身份认证 |
| domain | string / null | true | {} | 域名；本地或未知时为空 |
| account_name | string / null | true | {} | 域登录名，不能用显示名或目录猜测 |
| source | string | true | {"enum":["windows_logon","unavailable"]} | 采集来源 |
| display_name | string | false | {"minLength":1,"maxLength":120} | 域账号显示名，仅用于员工姓名 |

## IdentityRule

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| domain | string | true | {"minLength":1,"maxLength":128} | 允许的域，大小写不敏感 |
| format | string | true | {"enum":["digits","alphanumeric"]} | 工号格式，保留前导零 |
| case | string | true | {"enum":["preserve","upper","lower"]} | 登录名大小写归一化 |

## IdentityPolicy

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| version | integer | true | {"minimum":0,"maximum":2147483647} | 版本 |
| enabled | boolean | true | {} | 兼容字段，服务端固定为 true |
| auto_create | boolean | true | {} | 兼容字段，服务端固定为 true |
| rules | array<IdentityRule> | true | {"maxItems":20} | 兼容字段，服务端固定为空；所有域均按账号匹配工号 |

## IdentityPolicyUpdate

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| policy | IdentityPolicy | true | {} | 见引用对象 |
| expected_revision | integer | true | {"minimum":0,"maximum":2147483647} | 当前版本 |
| reason | string | true | {"minLength":1,"maxLength":500} | 修改原因 |

## IdentityResult

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| identity | WindowsIdentity / null | true | {} | 见引用对象 |
| state | string | true | {"enum":["missing","local","unknown","disabled","domain_not_allowed","invalid_account","employee_missing","employee_archived","identity_conflict","binding_preserved","matched"]} | 匹配结果 |
| employee_id | string / null | true | {} | 稳定 UUID，不能使用用户名代替 |
| binding_source | string | true | {"enum":["none","manual","automatic"]} | 当前绑定来源 |

## IdentityUpdate

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| identity | WindowsIdentity | true | {} | 见引用对象 |

## ServerCapabilities

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| capabilities | array<string> | true | {"maxItems":10} | 能力列表 |

## RegisterInput

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| registration_id | string | true | {"format":"uuid"} | 稳定 UUID，不能使用用户名代替 |
| installation_id | string | true | {"format":"uuid"} | 稳定 UUID，不能使用用户名代替 |
| credential | CredentialMaterial | true | {} | 见引用对象 |
| windows_username | string | true | {"minLength":1,"maxLength":128} | 当前系统账号；不是员工 ID |
| device_label | string | true | {"minLength":1,"maxLength":128} | 设备显示名 |
| app_version | string | true | {"minLength":1,"maxLength":64} | Piora 版本 |
| sdk_version | string | true | {"minLength":1,"maxLength":64} | Pi SDK 版本 |
| protocol_version | string | true | {"enum":["1.0"]} | 协议版本 |
| capabilities | array<string> | true | {"maxItems":20} | 客户端能力 |
| windows_identity | WindowsIdentity | false | {} | 见引用对象 |

## RegisterResult

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| installation_id | string | true | {"format":"uuid"} | 稳定 UUID，不能使用用户名代替 |
| status | string | true | {"enum":["active","pending_identity"]} | 可上报；人员绑定待确认不阻止接收 |
| organization_name | string | true | {"minLength":1,"maxLength":120} | 组织显示名称 |
| credential_id | string | true | {"format":"uuid"} | 稳定 UUID，不能使用用户名代替 |
| credential_expires_at | string | true | {"format":"date-time"} | 凭证有效期；90 天 |
| policy | SyncPolicy | true | {} | 见引用对象 |

## RotateInput

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| rotation_id | string | true | {"format":"uuid"} | 稳定 UUID，不能使用用户名代替 |
| next_credential | CredentialMaterial | true | {} | 见引用对象 |

## RotateResult

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| credential_id | string | true | {"format":"uuid"} | 稳定 UUID，不能使用用户名代替 |
| expires_at | string | true | {"format":"date-time"} | 新凭证 90 天有效期 |
| previous_valid_until | string | true | {"format":"date-time"} | 旧凭证过渡期，24 小时 |

## Installation

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| id | string | true | {"format":"uuid"} | 稳定 UUID，不能使用用户名代替 |
| windows_username | string | true | {"minLength":1,"maxLength":128} | Windows 账号 |
| device_label | string | true | {"minLength":1,"maxLength":128} | 设备显示名 |
| employee_id | string / null | true | {} | 当前绑定员工 |
| app_version | string | true | {"minLength":1,"maxLength":64} | 上次上报版本 |
| status | string | true | {"enum":["active","revoked"]} | 安装状态 |
| last_received_at | string / null | true | {} | 最后收到数据 |
| last_event_at | string / null | true | {} | 最后事件发生时间 |
| reported_queue_events | string | true | {"maxLength":19,"pattern":"^(0/[1-9][0-9]*)$"} | 上次上报时的积压，不是实时值；非负 int64 十进制字符串，最大 9223372036854775807 |
| coverage | Coverage | true | {} | 见引用对象 |
| revision | integer | true | {"minimum":0,"maximum":2147483647} | 版本 |
| identity_status | IdentityResult | false | {} | 见引用对象 |

## Binding

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| id | string | true | {"format":"uuid"} | 稳定 UUID，不能使用用户名代替 |
| installation_id | string | true | {"format":"uuid"} | 稳定 UUID，不能使用用户名代替 |
| employee_id | string | true | {"format":"uuid"} | 稳定 UUID，不能使用用户名代替 |
| valid_from | string / null | true | {} | 包含；null 覆盖全部历史 |
| valid_to | string / null | true | {} | 不包含；null 为持续 |
| reason | string | true | {"minLength":1,"maxLength":500} | 绑定/纠错原因 |
| revision | integer | true | {"minimum":0,"maximum":2147483647} | 版本 |

## BindingInput

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| employee_id | string | true | {"format":"uuid"} | 稳定 UUID，不能使用用户名代替 |
| valid_from | string / null | true | {} | 包含；北京时间自然日；null 覆盖全部历史 |
| valid_to | string / null | true | {} | 不包含 |
| reason | string | true | {"minLength":1,"maxLength":500} | 原因 |
| expected_revision | integer | true | {"minimum":0,"maximum":2147483647} | 安装/原绑定版本 |

## EnrollmentKey

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| id | string | true | {"format":"uuid"} | 稳定 UUID，不能使用用户名代替 |
| label | string | true | {"minLength":1,"maxLength":120} | 用途 |
| expires_at | string | true | {"format":"date-time"} | 过期时间 |
| max_registrations | integer | true | {"minimum":1,"maximum":5000} | 最多允许注册次数 |
| used_registrations | integer | true | {"minimum":0,"maximum":2147483647} | 已注册次数 |
| revoked_at | string / null | true | {} | 撤销时间 |
| revision | integer | true | {"minimum":0,"maximum":2147483647} | 乐观锁版本 |

## EnrollmentInput

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| label | string | true | {"minLength":1,"maxLength":120} | 用途 |
| expires_at | string | true | {"format":"date-time"} | 过期时间；必须晚于当前时间，不设业务期限上限 |
| max_registrations | integer | true | {"minimum":1,"maximum":5000} | 最多允许注册次数 |

## EnrollmentCreated

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| key | EnrollmentKey | true | {} | 见引用对象 |
| secret | string | true | {"minLength":1,"maxLength":128} | 只在本次响应展示；部署时通过安全配置分发 |

## AdminCreate

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| username | string | true | {"minLength":1,"maxLength":80} | 唯一后台账号 |
| display_name | string | true | {"minLength":1,"maxLength":120} | 显示名 |
| role | string | true | {"enum":["admin","viewer"]} | 角色 |
| temporary_password | string | true | {"minLength":12,"maxLength":256,"writeOnly":true} | 临时密码，首次登录强制修改 |

## AdminUpdate

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| display_name | string | true | {"minLength":1,"maxLength":120} | 显示名 |
| role | string | true | {"enum":["admin","viewer"]} | 角色 |
| status | string | true | {"enum":["active","disabled"]} | 状态 |
| expected_revision | integer | true | {"minimum":0,"maximum":2147483647} | 版本 |

## PolicyUpdate

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| policy | SyncPolicy | true | {} | 见引用对象 |
| expected_revision | integer | true | {"minimum":0,"maximum":2147483647} | 当前版本 |
| reason | string | true | {"minLength":1,"maxLength":500} | 变更原因 |

## RetentionPolicy

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| raw_days | integer | true | {"minimum":90,"maximum":365,"default":90} | 事件和明细保留天数 |
| daily_months | integer | true | {"minimum":24,"maximum":60,"default":24} | 日汇总保留月数 |
| audit_days | integer | true | {"minimum":365,"maximum":1825,"default":365} | 审计保留天数 |
| revision | integer | true | {"minimum":0,"maximum":2147483647} | 版本 |

## RetentionUpdate

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| policy | RetentionPolicy | true | {} | 见引用对象 |
| expected_revision | integer | true | {"minimum":0,"maximum":2147483647} | 版本 |
| reason | string | true | {"minLength":1,"maxLength":500} | 变更原因 |

## Metrics

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| queries | string | true | {"maxLength":19,"pattern":"^(0/[1-9][0-9]*)$"} | 人工提交数量；非负 int64 十进制字符串，最大 9223372036854775807 |
| completed_queries | string | true | {"maxLength":19,"pattern":"^(0/[1-9][0-9]*)$"} | 完成数量；非负 int64 十进制字符串，最大 9223372036854775807 |
| failed_queries | string | true | {"maxLength":19,"pattern":"^(0/[1-9][0-9]*)$"} | 失败数量；非负 int64 十进制字符串，最大 9223372036854775807 |
| cancelled_queries | string | true | {"maxLength":19,"pattern":"^(0/[1-9][0-9]*)$"} | 取消数量；非负 int64 十进制字符串，最大 9223372036854775807 |
| interrupted_queries | string | true | {"maxLength":19,"pattern":"^(0/[1-9][0-9]*)$"} | 异常中断数量；非负 int64 十进制字符串，最大 9223372036854775807 |
| pending_queries | string | true | {"maxLength":19,"pattern":"^(0/[1-9][0-9]*)$"} | 等待/运行/尚无终态数量；非负 int64 十进制字符串，最大 9223372036854775807 |
| opens | string | true | {"maxLength":19,"pattern":"^(0/[1-9][0-9]*)$"} | 明确手动打开/唤起次数；非负 int64 十进制字符串，最大 9223372036854775807 |
| launches | string | true | {"maxLength":19,"pattern":"^(0/[1-9][0-9]*)$"} | 进程冷启动次数；非负 int64 十进制字符串，最大 9223372036854775807 |
| runtime_ms | string | true | {"maxLength":19,"pattern":"^(0/[1-9][0-9]*)$"} | 非休眠运行时长；非负 int64 十进制字符串，最大 9223372036854775807 |
| active_ms | string | true | {"maxLength":19,"pattern":"^(0/[1-9][0-9]*)$"} | 前台有效活跃时长，多设备取并集；非负 int64 十进制字符串，最大 9223372036854775807 |
| task_ms | string / null | true | {} | 任务累计耗时；未知任务另计；非负 int64 十进制字符串，最大 9223372036854775807 |
| unknown_task_runs | string | true | {"maxLength":19,"pattern":"^(0/[1-9][0-9]*)$"} | 没有可信结束时间的任务数；非负 int64 十进制字符串，最大 9223372036854775807 |
| model_calls | string | true | {"maxLength":19,"pattern":"^(0/[1-9][0-9]*)$"} | 实际模型调用次数；非负 int64 十进制字符串，最大 9223372036854775807 |
| input_tokens | string / null | true | {} | 排除缓存后的输入；非负 int64 十进制字符串，最大 9223372036854775807 |
| output_tokens | string / null | true | {} | 输出；推理子项不再相加；非负 int64 十进制字符串，最大 9223372036854775807 |
| cache_read_tokens | string / null | true | {} | 缓存读取；非负 int64 十进制字符串，最大 9223372036854775807 |
| cache_write_tokens | string / null | true | {} | 缓存写入；非负 int64 十进制字符串，最大 9223372036854775807 |
| total_tokens | string / null | true | {} | 非重叠桶之和；仅有总量时保留总量；非负 int64 十进制字符串，最大 9223372036854775807 |
| added_lines | string | true | {"maxLength":19,"pattern":"^(0/[1-9][0-9]*)$"} | 代码新增行；非负 int64 十进制字符串，最大 9223372036854775807 |
| deleted_lines | string | true | {"maxLength":19,"pattern":"^(0/[1-9][0-9]*)$"} | 代码删除行；非负 int64 十进制字符串，最大 9223372036854775807 |
| files_created | string | true | {"maxLength":19,"pattern":"^(0/[1-9][0-9]*)$"} | 新建文件操作数；非负 int64 十进制字符串，最大 9223372036854775807 |
| files_touched | string | true | {"maxLength":19,"pattern":"^(0/[1-9][0-9]*)$"} | 按安装实例与文件标识去重；非负 int64 十进制字符串，最大 9223372036854775807 |
| file_operations | string | true | {"maxLength":19,"pattern":"^(0/[1-9][0-9]*)$"} | 文件工具操作数；非负 int64 十进制字符串，最大 9223372036854775807 |

## DailyRow

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| date | string | true | {"format":"date"} | 北京时间统计日期 |
| employee_id | string | true | {"format":"uuid"} | 稳定 UUID，不能使用用户名代替 |
| employee_name | string | true | {"minLength":1,"maxLength":120} | 员工姓名 |
| department_id | string / null | true | {} | 部门 |
| department_name | string / null | true | {} | 部门名称 |
| metrics | Metrics | true | {} | 见引用对象 |
| coverage | Coverage | true | {} | 见引用对象 |

## Overview

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| confirmed_employees | string | true | {"maxLength":19,"pattern":"^(0/[1-9][0-9]*)$"} | 已确认员工总数；非负 int64 十进制字符串，最大 9223372036854775807 |
| active_employees | string | true | {"maxLength":19,"pattern":"^(0/[1-9][0-9]*)$"} | 范围内去重活跃员工；非负 int64 十进制字符串，最大 9223372036854775807 |
| unconfirmed_installations | string | true | {"maxLength":19,"pattern":"^(0/[1-9][0-9]*)$"} | 未绑定安装实例；非负 int64 十进制字符串，最大 9223372036854775807 |
| metrics | Metrics | true | {} | 见引用对象 |

## TrendPoint

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| bucket | string | true | {"minLength":1,"maxLength":40} | 日期或带时区的小时桶 |
| active_employees | string | true | {"maxLength":19,"pattern":"^(0/[1-9][0-9]*)$"} | 该桶活跃人数；非负 int64 十进制字符串，最大 9223372036854775807 |
| metrics | Metrics | true | {} | 见引用对象 |

## ModelRow

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| provider | string | true | {"minLength":1,"maxLength":128} | 供应商标识 |
| model | string | true | {"minLength":1,"maxLength":256} | 模型 ID |
| calls | string | true | {"maxLength":19,"pattern":"^(0/[1-9][0-9]*)$"} | 调用次数；非负 int64 十进制字符串，最大 9223372036854775807 |
| queries | string | true | {"maxLength":19,"pattern":"^(0/[1-9][0-9]*)$"} | 涉及 Query 去重数；不同模型之间不可相加；非负 int64 十进制字符串，最大 9223372036854775807 |
| failed_calls | string | true | {"maxLength":19,"pattern":"^(0/[1-9][0-9]*)$"} | 失败次数；非负 int64 十进制字符串，最大 9223372036854775807 |
| input_tokens | string / null | true | {} | 输入；非负 int64 十进制字符串，最大 9223372036854775807 |
| output_tokens | string / null | true | {} | 输出；非负 int64 十进制字符串，最大 9223372036854775807 |
| cache_read_tokens | string / null | true | {} | 缓存读取；非负 int64 十进制字符串，最大 9223372036854775807 |
| cache_write_tokens | string / null | true | {} | 缓存写入；非负 int64 十进制字符串，最大 9223372036854775807 |
| total_tokens | string / null | true | {} | 总量；非负 int64 十进制字符串，最大 9223372036854775807 |
| known_calls | string | true | {"maxLength":19,"pattern":"^(0/[1-9][0-9]*)$"} | 用量已知调用；非负 int64 十进制字符串，最大 9223372036854775807 |
| unknown_calls | string | true | {"maxLength":19,"pattern":"^(0/[1-9][0-9]*)$"} | 用量未知调用；非负 int64 十进制字符串，最大 9223372036854775807 |
| duration_ms | string | true | {"maxLength":19,"pattern":"^(0/[1-9][0-9]*)$"} | 累计调用耗时；非负 int64 十进制字符串，最大 9223372036854775807 |

## CodeRow

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| language | string | true | {"minLength":1,"maxLength":80} | 语言分类 |
| file_category | string | true | {"enum":["code","config","document","other"]} | 文件分类 |
| added_lines | string | true | {"maxLength":19,"pattern":"^(0/[1-9][0-9]*)$"} | 新增行；非负 int64 十进制字符串，最大 9223372036854775807 |
| deleted_lines | string | true | {"maxLength":19,"pattern":"^(0/[1-9][0-9]*)$"} | 删除行；非负 int64 十进制字符串，最大 9223372036854775807 |
| files_touched | string | true | {"maxLength":19,"pattern":"^(0/[1-9][0-9]*)$"} | 文件实例去重数；非负 int64 十进制字符串，最大 9223372036854775807 |
| measured_operations | string | true | {"maxLength":19,"pattern":"^(0/[1-9][0-9]*)$"} | 可靠计量数；非负 int64 十进制字符串，最大 9223372036854775807 |
| unmeasured_operations | string | true | {"maxLength":19,"pattern":"^(0/[1-9][0-9]*)$"} | 无法计量数；非负 int64 十进制字符串，最大 9223372036854775807 |

## Query

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| id | string | true | {"format":"uuid"} | 稳定 UUID，不能使用用户名代替 |
| installation_id | string | true | {"format":"uuid"} | 稳定 UUID，不能使用用户名代替 |
| employee_id | string / null | true | {} | 根据发生日映射员工 |
| source | string | true | {"enum":["chat","room","remote","automation","system","compaction","review","vision","prompt_optimize","prediction","model_test","shell","companion"]} | 实际调用来源；人工身份由入口确定 |
| accepted_at | string | true | {"format":"date-time"} | 持久接收时间 |
| status | string | true | {"enum":["accepted","queued","running","completed","failed","cancelled","interrupted"]} | 请求状态 |
| revision | integer | true | {"minimum":0,"maximum":2147483647} | 状态版本 |
| run_ids | array<string> | true | {"maxItems":100} | 任务列表 |
| metrics | Metrics | true | {} | 见引用对象 |
| coverage | Coverage | true | {} | 见引用对象 |

## ModelCall

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| id | string | true | {"format":"uuid"} | 稳定 UUID，不能使用用户名代替 |
| query_id | string / null | true | {} | 调用开始时确定的归属 Query |
| run_id | string / null | true | {} | 任务 |
| provider | string | true | {"minLength":1,"maxLength":128} | 供应商 |
| model | string | true | {"minLength":1,"maxLength":256} | 实际模型 |
| source | string | true | {"enum":["chat","room","remote","automation","system","compaction","review","vision","prompt_optimize","prediction","model_test","shell","companion"]} | 实际调用来源；人工身份由入口确定 |
| status | string | true | {"enum":["completed","failed","cancelled","interrupted"]} | 终态；不得被迟到的运行态覆盖 |
| started_at | string | true | {"format":"date-time"} | 开始 |
| finished_at | string / null | true | {} | 结束；崩溃且无可信终点时为 null |
| duration_ms | string / null | true | {} | 单调时钟耗时；崩溃未知为 null；非负 int64 十进制字符串，最大 9223372036854775807 |
| usage_status | string | true | {"enum":["reported","partial","unavailable"]} | 用量来源/完整性 |
| input_tokens | string / null | true | {} | 普通输入；非负 int64 十进制字符串，最大 9223372036854775807 |
| output_tokens | string / null | true | {} | 输出；非负 int64 十进制字符串，最大 9223372036854775807 |
| cache_read_tokens | string / null | true | {} | 缓存读取；非负 int64 十进制字符串，最大 9223372036854775807 |
| cache_write_tokens | string / null | true | {} | 缓存写入；非负 int64 十进制字符串，最大 9223372036854775807 |
| total_tokens | string / null | true | {} | 总量；非负 int64 十进制字符串，最大 9223372036854775807 |

## FileChange

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| operation_id | string | true | {"format":"uuid"} | 稳定 UUID，不能使用用户名代替 |
| run_id | string / null | true | {} | 关联任务 |
| query_id | string / null | true | {} | 关联 Query |
| tool_call_id | string | true | {"minLength":1,"maxLength":256} | 原工具调用 ID |
| file_key | string | true | {"minLength":1,"maxLength":64,"pattern":"^[a-f0-9]{64}$"} | 安装实例内 HMAC-SHA256 文件标识 |
| language | string | true | {"minLength":1,"maxLength":80} | 语言 |
| file_category | string | true | {"enum":["code","config","document","other"]} | 分类 |
| kind | string | true | {"enum":["created","updated","unchanged","unknown"]} | 变化类型 |
| added_lines | string / null | true | {} | 新增行；非负 int64 十进制字符串，最大 9223372036854775807 |
| deleted_lines | string / null | true | {} | 删除行；非负 int64 十进制字符串，最大 9223372036854775807 |
| measurement_status | string | true | {"enum":["measured","unsupported","too_large","binary","unreadable","concurrent_change","failed"]} | 计量状态 |

## QueryDetail

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| query | Query | true | {} | 见引用对象 |
| calls | array<ModelCall> | true | {"maxItems":500} | 调用明细 |
| file_changes | array<FileChange> | true | {"maxItems":500} | 文件明细 |
| truncated | boolean | true | {} | 超过明细上限；可按单独游标接口继续查询 |

## AuditRow

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| id | string | true | {"format":"uuid"} | 稳定 UUID，不能使用用户名代替 |
| actor_id | string | true | {"format":"uuid"} | 稳定 UUID，不能使用用户名代替 |
| action | string | true | {"minLength":1,"maxLength":80} | 管理动作 |
| target_type | string | true | {"minLength":1,"maxLength":80} | 对象类型 |
| target_id | string | true | {"format":"uuid"} | 稳定 UUID，不能使用用户名代替 |
| occurred_at | string | true | {"format":"date-time"} | 操作时间 |
| summary | string | true | {"minLength":1,"maxLength":500} | 脱敏操作摘要 |

## ExportInput

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| kind | string | true | {"enum":["employee_daily","models","code"]} | 导出类型 |
| from | string | true | {"format":"date"} | 包含 |
| to | string | true | {"format":"date"} | 不包含 |
| employee_ids | array<string> | true | {"maxItems":500} | 员工筛选 |
| department_ids | array<string> | true | {"maxItems":100} | 部门筛选 |
| app_versions | array<string> | true | {"maxItems":30} | 版本筛选 |

## ExportJob

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| id | string | true | {"format":"uuid"} | 稳定 UUID，不能使用用户名代替 |
| status | string | true | {"enum":["queued","running","completed","failed","expired"]} | 任务状态 |
| created_at | string | true | {"format":"date-time"} | 创建时间 |
| row_count | string / null | true | {} | 导出行数；非负 int64 十进制字符串，最大 9223372036854775807 |
| expires_at | string | true | {"format":"date-time"} | 24 小时后过期 |
| download_path | string / null | true | {} | 同源受保护下载路径 |
| error_code | string / null | true | {} | 失败原因码 |

## Catalog

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| employees | array<Employee> | true | {"maxItems":5000} | 员工 |
| departments | array<Department> | true | {"maxItems":500} | 部门 |
| app_versions | array<string> | true | {"maxItems":100} | 版本 |
| sources | array<string> | true | {"maxItems":30} | 来源 |
| languages | array<string> | true | {"maxItems":200} | 语言 |

## HealthSummary

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| installations | array<Installation> | true | {"maxItems":5000} | 安装实例 |
| unbound_count | string | true | {"maxLength":19,"pattern":"^(0/[1-9][0-9]*)$"} | 未绑定数；非负 int64 十进制字符串，最大 9223372036854775807 |
| stale_report_count | string | true | {"maxLength":19,"pattern":"^(0/[1-9][0-9]*)$"} | 超过组织最长同步间隔加 5 分钟后的未上报数；兼容旧客户端的判断窗口至少为 40 分钟，不等于离线；非负 int64 十进制字符串，最大 9223372036854775807 |
| rejected_events | string | true | {"maxLength":19,"pattern":"^(0/[1-9][0-9]*)$"} | 范围内拒收数；非负 int64 十进制字符串，最大 9223372036854775807 |
| aggregation_lag_seconds | integer | true | {"minimum":0,"maximum":2147483647} | 服务端聚合延迟 |
| warning_codes | array<string> | true | {"maxItems":100} | 异常 |

## DesktopStarted

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| reason | string | true | {"enum":["manual","autostart","update","unknown"]} | 启动来源 |

## DesktopOpened

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| activation_id | string | true | {"format":"uuid"} | 稳定 UUID，不能使用用户名代替 |
| reason | string | true | {"enum":["manual_launch","shortcut","tray","menu"]} | 明确唤起来源 |

## DesktopActivity

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| start_at | string | true | {"format":"date-time"} | 包含 |
| end_at | string | true | {"format":"date-time"} | 不包含，最长 60 秒 |
| runtime_ms | string | true | {"maxLength":19,"pattern":"^(0/[1-9][0-9]*)$"} | 运行毫秒；非负 int64 十进制字符串，最大 9223372036854775807 |
| active_ranges | array<object> | true | {"maxItems":30} | 区间；必须在事件区间内且互不重叠 |
| sample_interval_ms | integer | true | {"const":5000} | 采样周期 |
| time_quality | string | true | {"enum":["synchronized","local_only","suspect"]} | 时间质量 |

## QuerySubmitted

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| query_id | string | true | {"format":"uuid"} | 稳定 UUID，不能使用用户名代替 |
| command_id | string | true | {"minLength":1,"maxLength":256} | 稳定接收命令 ID |
| source | string | true | {"enum":["chat","room","remote","automation","system","compaction","review","vision","prompt_optimize","prediction","model_test","shell","companion"]} | 实际调用来源；人工身份由入口确定 |
| trigger | string | true | {"enum":["human","automation","system"]} | 人工仅由可信入口标记 |
| accepted_at | string | true | {"format":"date-time"} | 本地持久接收时间 |

## QueryUpdated

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| query_id | string | true | {"format":"uuid"} | 稳定 UUID，不能使用用户名代替 |
| revision | integer | true | {"minimum":0,"maximum":2147483647} | 状态递增版本 |
| status | string | true | {"enum":["queued","running","completed","failed","cancelled","interrupted"]} | 状态 |
| run_id | string / null | true | {} | 关联任务 |

## RunStarted

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| run_id | string | true | {"format":"uuid"} | 稳定 UUID，不能使用用户名代替 |
| query_id | string / null | true | {} | 触发 Query |
| parent_run_id | string / null | true | {} | 父任务 |
| source | string | true | {"enum":["chat","room","remote","automation","system","compaction","review","vision","prompt_optimize","prediction","model_test","shell","companion"]} | 实际调用来源；人工身份由入口确定 |
| started_at | string | true | {"format":"date-time"} | 开始时间 |

## RunFinished

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| run_id | string | true | {"format":"uuid"} | 稳定 UUID，不能使用用户名代替 |
| outcome | string | true | {"enum":["completed","failed","cancelled","interrupted"]} | 终态；不得被迟到的运行态覆盖 |
| duration_ms | string / null | true | {} | 可信单调时钟总耗时；非负 int64 十进制字符串，最大 9223372036854775807 |
| waiting_ms | string / null | true | {} | 等待人工时间；非负 int64 十进制字符串，最大 9223372036854775807 |
| finished_at | string / null | true | {} | 没有可信终点时为 null |

## ModelStarted

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| call_id | string | true | {"format":"uuid"} | 稳定 UUID，不能使用用户名代替 |
| query_id | string / null | true | {} | 归属 Query |
| run_id | string / null | true | {} | 归属任务 |
| provider | string | true | {"minLength":1,"maxLength":128} | 实际供应商 |
| model | string | true | {"minLength":1,"maxLength":256} | 实际模型 |
| source | string | true | {"enum":["chat","room","remote","automation","system","compaction","review","vision","prompt_optimize","prediction","model_test","shell","companion"]} | 实际调用来源；人工身份由入口确定 |
| started_at | string | true | {"format":"date-time"} | 请求开始时间 |

## ClientHealth

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| queue_events | string | true | {"maxLength":19,"pattern":"^(0/[1-9][0-9]*)$"} | 当前本地排队数；非负 int64 十进制字符串，最大 9223372036854775807 |
| queue_bytes | string | true | {"maxLength":19,"pattern":"^(0/[1-9][0-9]*)$"} | 排队字节；非负 int64 十进制字符串，最大 9223372036854775807 |
| dropped_events | string | true | {"maxLength":19,"pattern":"^(0/[1-9][0-9]*)$"} | 新增丢弃数；非负 int64 十进制字符串，最大 9223372036854775807 |
| quarantined_events | string | true | {"maxLength":19,"pattern":"^(0/[1-9][0-9]*)$"} | 新增隔离数；非负 int64 十进制字符串，最大 9223372036854775807 |
| clock_offset_ms | integer | true | {"minimum":-86400000,"maximum":86400000} | 上次测得服务端与客户端偏差 |
| clock_sync_at | string / null | true | {} | 测量时间 |
| codes | array<string> | true | {"maxItems":30} | 原因码 |

## DesktopStartedEvent

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| event_id | string | true | {"format":"uuid"} | 稳定 UUID，不能使用用户名代替 |
| event_seq | string | true | {"maxLength":19,"pattern":"^(0/[1-9][0-9]*)$"} | 安装实例内事务分配的递增序号；非负 int64 十进制字符串，最大 9223372036854775807 |
| source_key | string | true | {"minLength":1,"maxLength":512} | 稳定业务来源键，用于本地重放去重 |
| event_type | string | true | {"const":"desktop.started"} | 事件类型 |
| occurred_at | string | true | {"format":"date-time"} | 实际发生时间；不是上传时间 |
| app_launch_id | string | true | {"format":"uuid"} | 稳定 UUID，不能使用用户名代替 |
| app_version | string | true | {"minLength":1,"maxLength":64} | 发生时的版本 |
| payload | DesktopStarted | true | {} | 见引用对象 |

## DesktopOpenedEvent

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| event_id | string | true | {"format":"uuid"} | 稳定 UUID，不能使用用户名代替 |
| event_seq | string | true | {"maxLength":19,"pattern":"^(0/[1-9][0-9]*)$"} | 安装实例内事务分配的递增序号；非负 int64 十进制字符串，最大 9223372036854775807 |
| source_key | string | true | {"minLength":1,"maxLength":512} | 稳定业务来源键，用于本地重放去重 |
| event_type | string | true | {"const":"desktop.opened"} | 事件类型 |
| occurred_at | string | true | {"format":"date-time"} | 实际发生时间；不是上传时间 |
| app_launch_id | string | true | {"format":"uuid"} | 稳定 UUID，不能使用用户名代替 |
| app_version | string | true | {"minLength":1,"maxLength":64} | 发生时的版本 |
| payload | DesktopOpened | true | {} | 见引用对象 |

## DesktopActivityEvent

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| event_id | string | true | {"format":"uuid"} | 稳定 UUID，不能使用用户名代替 |
| event_seq | string | true | {"maxLength":19,"pattern":"^(0/[1-9][0-9]*)$"} | 安装实例内事务分配的递增序号；非负 int64 十进制字符串，最大 9223372036854775807 |
| source_key | string | true | {"minLength":1,"maxLength":512} | 稳定业务来源键，用于本地重放去重 |
| event_type | string | true | {"const":"desktop.activity"} | 事件类型 |
| occurred_at | string | true | {"format":"date-time"} | 实际发生时间；不是上传时间 |
| app_launch_id | string | true | {"format":"uuid"} | 稳定 UUID，不能使用用户名代替 |
| app_version | string | true | {"minLength":1,"maxLength":64} | 发生时的版本 |
| payload | DesktopActivity | true | {} | 见引用对象 |

## QuerySubmittedEvent

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| event_id | string | true | {"format":"uuid"} | 稳定 UUID，不能使用用户名代替 |
| event_seq | string | true | {"maxLength":19,"pattern":"^(0/[1-9][0-9]*)$"} | 安装实例内事务分配的递增序号；非负 int64 十进制字符串，最大 9223372036854775807 |
| source_key | string | true | {"minLength":1,"maxLength":512} | 稳定业务来源键，用于本地重放去重 |
| event_type | string | true | {"const":"query.submitted"} | 事件类型 |
| occurred_at | string | true | {"format":"date-time"} | 实际发生时间；不是上传时间 |
| app_launch_id | string | true | {"format":"uuid"} | 稳定 UUID，不能使用用户名代替 |
| app_version | string | true | {"minLength":1,"maxLength":64} | 发生时的版本 |
| payload | QuerySubmitted | true | {} | 见引用对象 |

## QueryUpdatedEvent

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| event_id | string | true | {"format":"uuid"} | 稳定 UUID，不能使用用户名代替 |
| event_seq | string | true | {"maxLength":19,"pattern":"^(0/[1-9][0-9]*)$"} | 安装实例内事务分配的递增序号；非负 int64 十进制字符串，最大 9223372036854775807 |
| source_key | string | true | {"minLength":1,"maxLength":512} | 稳定业务来源键，用于本地重放去重 |
| event_type | string | true | {"const":"query.updated"} | 事件类型 |
| occurred_at | string | true | {"format":"date-time"} | 实际发生时间；不是上传时间 |
| app_launch_id | string | true | {"format":"uuid"} | 稳定 UUID，不能使用用户名代替 |
| app_version | string | true | {"minLength":1,"maxLength":64} | 发生时的版本 |
| payload | QueryUpdated | true | {} | 见引用对象 |

## RunStartedEvent

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| event_id | string | true | {"format":"uuid"} | 稳定 UUID，不能使用用户名代替 |
| event_seq | string | true | {"maxLength":19,"pattern":"^(0/[1-9][0-9]*)$"} | 安装实例内事务分配的递增序号；非负 int64 十进制字符串，最大 9223372036854775807 |
| source_key | string | true | {"minLength":1,"maxLength":512} | 稳定业务来源键，用于本地重放去重 |
| event_type | string | true | {"const":"run.started"} | 事件类型 |
| occurred_at | string | true | {"format":"date-time"} | 实际发生时间；不是上传时间 |
| app_launch_id | string | true | {"format":"uuid"} | 稳定 UUID，不能使用用户名代替 |
| app_version | string | true | {"minLength":1,"maxLength":64} | 发生时的版本 |
| payload | RunStarted | true | {} | 见引用对象 |

## RunFinishedEvent

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| event_id | string | true | {"format":"uuid"} | 稳定 UUID，不能使用用户名代替 |
| event_seq | string | true | {"maxLength":19,"pattern":"^(0/[1-9][0-9]*)$"} | 安装实例内事务分配的递增序号；非负 int64 十进制字符串，最大 9223372036854775807 |
| source_key | string | true | {"minLength":1,"maxLength":512} | 稳定业务来源键，用于本地重放去重 |
| event_type | string | true | {"const":"run.finished"} | 事件类型 |
| occurred_at | string | true | {"format":"date-time"} | 实际发生时间；不是上传时间 |
| app_launch_id | string | true | {"format":"uuid"} | 稳定 UUID，不能使用用户名代替 |
| app_version | string | true | {"minLength":1,"maxLength":64} | 发生时的版本 |
| payload | RunFinished | true | {} | 见引用对象 |

## ModelStartedEvent

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| event_id | string | true | {"format":"uuid"} | 稳定 UUID，不能使用用户名代替 |
| event_seq | string | true | {"maxLength":19,"pattern":"^(0/[1-9][0-9]*)$"} | 安装实例内事务分配的递增序号；非负 int64 十进制字符串，最大 9223372036854775807 |
| source_key | string | true | {"minLength":1,"maxLength":512} | 稳定业务来源键，用于本地重放去重 |
| event_type | string | true | {"const":"model.started"} | 事件类型 |
| occurred_at | string | true | {"format":"date-time"} | 实际发生时间；不是上传时间 |
| app_launch_id | string | true | {"format":"uuid"} | 稳定 UUID，不能使用用户名代替 |
| app_version | string | true | {"minLength":1,"maxLength":64} | 发生时的版本 |
| payload | ModelStarted | true | {} | 见引用对象 |

## ModelFinishedEvent

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| event_id | string | true | {"format":"uuid"} | 稳定 UUID，不能使用用户名代替 |
| event_seq | string | true | {"maxLength":19,"pattern":"^(0/[1-9][0-9]*)$"} | 安装实例内事务分配的递增序号；非负 int64 十进制字符串，最大 9223372036854775807 |
| source_key | string | true | {"minLength":1,"maxLength":512} | 稳定业务来源键，用于本地重放去重 |
| event_type | string | true | {"const":"model.finished"} | 事件类型 |
| occurred_at | string | true | {"format":"date-time"} | 实际发生时间；不是上传时间 |
| app_launch_id | string | true | {"format":"uuid"} | 稳定 UUID，不能使用用户名代替 |
| app_version | string | true | {"minLength":1,"maxLength":64} | 发生时的版本 |
| payload | ModelCall | true | {} | 见引用对象 |

## FileChangedEvent

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| event_id | string | true | {"format":"uuid"} | 稳定 UUID，不能使用用户名代替 |
| event_seq | string | true | {"maxLength":19,"pattern":"^(0/[1-9][0-9]*)$"} | 安装实例内事务分配的递增序号；非负 int64 十进制字符串，最大 9223372036854775807 |
| source_key | string | true | {"minLength":1,"maxLength":512} | 稳定业务来源键，用于本地重放去重 |
| event_type | string | true | {"const":"file.changed"} | 事件类型 |
| occurred_at | string | true | {"format":"date-time"} | 实际发生时间；不是上传时间 |
| app_launch_id | string | true | {"format":"uuid"} | 稳定 UUID，不能使用用户名代替 |
| app_version | string | true | {"minLength":1,"maxLength":64} | 发生时的版本 |
| payload | FileChange | true | {} | 见引用对象 |

## ClientHealthEvent

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| event_id | string | true | {"format":"uuid"} | 稳定 UUID，不能使用用户名代替 |
| event_seq | string | true | {"maxLength":19,"pattern":"^(0/[1-9][0-9]*)$"} | 安装实例内事务分配的递增序号；非负 int64 十进制字符串，最大 9223372036854775807 |
| source_key | string | true | {"minLength":1,"maxLength":512} | 稳定业务来源键，用于本地重放去重 |
| event_type | string | true | {"const":"client.health"} | 事件类型 |
| occurred_at | string | true | {"format":"date-time"} | 实际发生时间；不是上传时间 |
| app_launch_id | string | true | {"format":"uuid"} | 稳定 UUID，不能使用用户名代替 |
| app_version | string | true | {"minLength":1,"maxLength":64} | 发生时的版本 |
| payload | ClientHealth | true | {} | 见引用对象 |

## TelemetryEvent

DesktopStartedEvent | DesktopOpenedEvent | DesktopActivityEvent | QuerySubmittedEvent | QueryUpdatedEvent | RunStartedEvent | RunFinishedEvent | ModelStartedEvent | ModelFinishedEvent | FileChangedEvent | ClientHealthEvent

## BatchInput

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| batch_id | string | true | {"format":"uuid"} | 稳定 UUID，不能使用用户名代替 |
| protocol_version | string | true | {"enum":["1.0"]} | 协议版本 |
| client_sent_at | string | true | {"format":"date-time"} | 发送时间 |
| policy_version | integer | true | {"minimum":0,"maximum":2147483647} | 策略版本 |
| events | array<TelemetryEvent> | true | {"maxItems":500} | 新增事件；相同 ID 重传不再次累计 |

## RejectedEvent

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| event_id | string | true | {"format":"uuid"} | 稳定 UUID，不能使用用户名代替 |
| code | string | true | {"enum":["INVALID_EVENT","EVENT_CONFLICT","UNSUPPORTED_VERSION","EVENT_TOO_OLD","CLOCK_SUSPECT"]} | 拒绝原因 |
| message | string | true | {"minLength":1,"maxLength":300} | 安全信息 |
| retryable | boolean | true | {"const":false} | 此事件需隔离；同内容重试不会恢复 |

## BatchResult

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| accepted_event_ids | array<string> | true | {"maxItems":500} | 已持久接收 |
| duplicate_event_ids | array<string> | true | {"maxItems":500} | 已接收过且内容相同 |
| rejected_events | array<RejectedEvent> | true | {"maxItems":500} | 永久拒绝 |
| retry_after_seconds | integer / null | true | {} | 最早允许再发时间；延后指令 |
| policy | SyncPolicy / null | true | {} | 见引用对象 |
| credential_rotation_due | boolean | true | {} | 凭证剩余有效期小于 7 天 |

## EmployeeDetail

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| employee | Employee | true | {} | 见引用对象 |
| daily | array<DailyRow> | true | {"maxItems":731} | 日统计 |
| installations | array<Installation> | true | {"maxItems":100} | 关联设备 |

## ServiceHealth

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| status | string | true | {"enum":["ok"]} | 服务状态 |

## DailyRowPage

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| items | array<DailyRow> | true | {"maxItems":200} | 本页记录 |
| next_cursor | string / null | true | {} | 后续游标 |
| total | string | true | {"maxLength":19,"pattern":"^(0/[1-9][0-9]*)$"} | 匹配记录数；非负 int64 十进制字符串，最大 9223372036854775807 |

## EmployeePage

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| items | array<Employee> | true | {"maxItems":200} | 本页记录 |
| next_cursor | string / null | true | {} | 后续游标 |
| total | string | true | {"maxLength":19,"pattern":"^(0/[1-9][0-9]*)$"} | 匹配记录数；非负 int64 十进制字符串，最大 9223372036854775807 |

## DepartmentPage

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| items | array<Department> | true | {"maxItems":200} | 本页记录 |
| next_cursor | string / null | true | {} | 后续游标 |
| total | string | true | {"maxLength":19,"pattern":"^(0/[1-9][0-9]*)$"} | 匹配记录数；非负 int64 十进制字符串，最大 9223372036854775807 |

## InstallationPage

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| items | array<Installation> | true | {"maxItems":200} | 本页记录 |
| next_cursor | string / null | true | {} | 后续游标 |
| total | string | true | {"maxLength":19,"pattern":"^(0/[1-9][0-9]*)$"} | 匹配记录数；非负 int64 十进制字符串，最大 9223372036854775807 |

## BindingPage

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| items | array<Binding> | true | {"maxItems":200} | 本页记录 |
| next_cursor | string / null | true | {} | 后续游标 |
| total | string | true | {"maxLength":19,"pattern":"^(0/[1-9][0-9]*)$"} | 匹配记录数；非负 int64 十进制字符串，最大 9223372036854775807 |

## EnrollmentKeyPage

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| items | array<EnrollmentKey> | true | {"maxItems":200} | 本页记录 |
| next_cursor | string / null | true | {} | 后续游标 |
| total | string | true | {"maxLength":19,"pattern":"^(0/[1-9][0-9]*)$"} | 匹配记录数；非负 int64 十进制字符串，最大 9223372036854775807 |

## AdminUserPage

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| items | array<AdminUser> | true | {"maxItems":200} | 本页记录 |
| next_cursor | string / null | true | {} | 后续游标 |
| total | string | true | {"maxLength":19,"pattern":"^(0/[1-9][0-9]*)$"} | 匹配记录数；非负 int64 十进制字符串，最大 9223372036854775807 |

## AuditRowPage

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| items | array<AuditRow> | true | {"maxItems":200} | 本页记录 |
| next_cursor | string / null | true | {} | 后续游标 |
| total | string | true | {"maxLength":19,"pattern":"^(0/[1-9][0-9]*)$"} | 匹配记录数；非负 int64 十进制字符串，最大 9223372036854775807 |

## QueryPage

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| items | array<Query> | true | {"maxItems":200} | 本页记录 |
| next_cursor | string / null | true | {} | 后续游标 |
| total | string | true | {"maxLength":19,"pattern":"^(0/[1-9][0-9]*)$"} | 匹配记录数；非负 int64 十进制字符串，最大 9223372036854775807 |

## ModelCallPage

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| items | array<ModelCall> | true | {"maxItems":200} | 本页记录 |
| next_cursor | string / null | true | {} | 后续游标 |
| total | string | true | {"maxLength":19,"pattern":"^(0/[1-9][0-9]*)$"} | 匹配记录数；非负 int64 十进制字符串，最大 9223372036854775807 |

## FileChangePage

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| items | array<FileChange> | true | {"maxItems":200} | 本页记录 |
| next_cursor | string / null | true | {} | 后续游标 |
| total | string | true | {"maxLength":19,"pattern":"^(0/[1-9][0-9]*)$"} | 匹配记录数；非负 int64 十进制字符串，最大 9223372036854775807 |

## TrendPointList

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| items | array<TrendPoint> | true | {"maxItems":1000} | 完整汇总序列 |

## ModelRowList

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| items | array<ModelRow> | true | {"maxItems":1000} | 完整汇总序列 |

## CodeRowList

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| items | array<CodeRow> | true | {"maxItems":1000} | 完整汇总序列 |

## loginResponse

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| data | Session | true | {} | 见引用对象 |
| meta | Meta | true | {} | 见引用对象 |

## logoutResponse

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| data | Ok | true | {} | 见引用对象 |
| meta | Meta | true | {} | 见引用对象 |

## sessionResponse

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| data | Session | true | {} | 见引用对象 |
| meta | Meta | true | {} | 见引用对象 |

## changePasswordResponse

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| data | Ok | true | {} | 见引用对象 |
| meta | Meta | true | {} | 见引用对象 |

## serverCapabilitiesResponse

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| data | ServerCapabilities | true | {} | 见引用对象 |
| meta | Meta | true | {} | 见引用对象 |

## updateIdentityResponse

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| data | IdentityResult | true | {} | 见引用对象 |
| meta | Meta | true | {} | 见引用对象 |

## getIdentityPolicyResponse

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| data | IdentityPolicy | true | {} | 见引用对象 |
| meta | Meta | true | {} | 见引用对象 |

## updateIdentityPolicyResponse

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| data | IdentityPolicy | true | {} | 见引用对象 |
| meta | Meta | true | {} | 见引用对象 |

## registerInstallationResponse

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| data | RegisterResult | true | {} | 见引用对象 |
| meta | Meta | true | {} | 见引用对象 |

## rotateCredentialResponse

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| data | RotateResult | true | {} | 见引用对象 |
| meta | Meta | true | {} | 见引用对象 |

## ingestBatchResponse

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| data | BatchResult | true | {} | 见引用对象 |
| meta | Meta | true | {} | 见引用对象 |

## reportoverviewResponse

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| data | Overview | true | {} | 见引用对象 |
| meta | ReportMeta | true | {} | 见引用对象 |

## reporttrendsResponse

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| data | TrendPointList | true | {} | 见引用对象 |
| meta | ReportMeta | true | {} | 见引用对象 |

## reportemployeesdailyResponse

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| data | DailyRowPage | true | {} | 见引用对象 |
| meta | ReportMeta | true | {} | 见引用对象 |

## reportemployeesidResponse

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| data | EmployeeDetail | true | {} | 见引用对象 |
| meta | ReportMeta | true | {} | 见引用对象 |

## reportqueriesResponse

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| data | QueryPage | true | {} | 见引用对象 |
| meta | ReportMeta | true | {} | 见引用对象 |

## reportqueriesidResponse

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| data | QueryDetail | true | {} | 见引用对象 |
| meta | ReportMeta | true | {} | 见引用对象 |

## reportqueriesidcallsResponse

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| data | ModelCallPage | true | {} | 见引用对象 |
| meta | ReportMeta | true | {} | 见引用对象 |

## reportqueriesidfilechangesResponse

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| data | FileChangePage | true | {} | 见引用对象 |
| meta | ReportMeta | true | {} | 见引用对象 |

## reportmodelsResponse

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| data | ModelRowList | true | {} | 见引用对象 |
| meta | ReportMeta | true | {} | 见引用对象 |

## reportcodeResponse

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| data | CodeRowList | true | {} | 见引用对象 |
| meta | ReportMeta | true | {} | 见引用对象 |

## reporthealthResponse

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| data | HealthSummary | true | {} | 见引用对象 |
| meta | ReportMeta | true | {} | 见引用对象 |

## catalogResponse

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| data | Catalog | true | {} | 见引用对象 |
| meta | Meta | true | {} | 见引用对象 |

## listEmployeeResponse

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| data | EmployeePage | true | {} | 见引用对象 |
| meta | Meta | true | {} | 见引用对象 |

## createEmployeeResponse

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| data | Employee | true | {} | 见引用对象 |
| meta | Meta | true | {} | 见引用对象 |

## updateEmployeeResponse

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| data | Employee | true | {} | 见引用对象 |
| meta | Meta | true | {} | 见引用对象 |

## archiveEmployeeResponse

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| data | Ok | true | {} | 见引用对象 |
| meta | Meta | true | {} | 见引用对象 |

## listDepartmentResponse

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| data | DepartmentPage | true | {} | 见引用对象 |
| meta | Meta | true | {} | 见引用对象 |

## createDepartmentResponse

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| data | Department | true | {} | 见引用对象 |
| meta | Meta | true | {} | 见引用对象 |

## updateDepartmentResponse

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| data | Department | true | {} | 见引用对象 |
| meta | Meta | true | {} | 见引用对象 |

## archiveDepartmentResponse

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| data | Ok | true | {} | 见引用对象 |
| meta | Meta | true | {} | 见引用对象 |

## listAdminUserResponse

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| data | AdminUserPage | true | {} | 见引用对象 |
| meta | Meta | true | {} | 见引用对象 |

## createAdminUserResponse

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| data | AdminUser | true | {} | 见引用对象 |
| meta | Meta | true | {} | 见引用对象 |

## updateAdminUserResponse

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| data | AdminUser | true | {} | 见引用对象 |
| meta | Meta | true | {} | 见引用对象 |

## archiveAdminUserResponse

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| data | Ok | true | {} | 见引用对象 |
| meta | Meta | true | {} | 见引用对象 |

## revokeSessionsResponse

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| data | Ok | true | {} | 见引用对象 |
| meta | Meta | true | {} | 见引用对象 |

## listInstallationsResponse

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| data | InstallationPage | true | {} | 见引用对象 |
| meta | Meta | true | {} | 见引用对象 |

## getInstallationResponse

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| data | Installation | true | {} | 见引用对象 |
| meta | Meta | true | {} | 见引用对象 |

## listBindingsResponse

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| data | BindingPage | true | {} | 见引用对象 |
| meta | Meta | true | {} | 见引用对象 |

## createBindingResponse

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| data | Binding | true | {} | 见引用对象 |
| meta | Meta | true | {} | 见引用对象 |

## correctBindingResponse

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| data | Binding | true | {} | 见引用对象 |
| meta | Meta | true | {} | 见引用对象 |

## revokeInstallationResponse

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| data | Ok | true | {} | 见引用对象 |
| meta | Meta | true | {} | 见引用对象 |

## listEnrollmentResponse

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| data | EnrollmentKeyPage | true | {} | 见引用对象 |
| meta | Meta | true | {} | 见引用对象 |

## createEnrollmentResponse

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| data | EnrollmentCreated | true | {} | 见引用对象 |
| meta | Meta | true | {} | 见引用对象 |

## revokeEnrollmentResponse

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| data | Ok | true | {} | 见引用对象 |
| meta | Meta | true | {} | 见引用对象 |

## getSyncResponse

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| data | SyncPolicy | true | {} | 见引用对象 |
| meta | Meta | true | {} | 见引用对象 |

## updateSyncResponse

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| data | SyncPolicy | true | {} | 见引用对象 |
| meta | Meta | true | {} | 见引用对象 |

## getRetentionResponse

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| data | RetentionPolicy | true | {} | 见引用对象 |
| meta | Meta | true | {} | 见引用对象 |

## updateRetentionResponse

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| data | RetentionPolicy | true | {} | 见引用对象 |
| meta | Meta | true | {} | 见引用对象 |

## listAuditResponse

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| data | AuditRowPage | true | {} | 见引用对象 |
| meta | Meta | true | {} | 见引用对象 |

## createExportResponse

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| data | ExportJob | true | {} | 见引用对象 |
| meta | Meta | true | {} | 见引用对象 |

## getExportResponse

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| data | ExportJob | true | {} | 见引用对象 |
| meta | Meta | true | {} | 见引用对象 |

## livenessResponse

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| data | ServiceHealth | true | {} | 见引用对象 |
| meta | Meta | true | {} | 见引用对象 |

## readinessResponse

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---|---|---|
| data | ServiceHealth | true | {} | 见引用对象 |
| meta | Meta | true | {} | 见引用对象 |
