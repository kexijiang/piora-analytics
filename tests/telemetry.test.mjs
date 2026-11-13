import test from "node:test";
import assert from "node:assert/strict";
import {
  splitDays,
  intervalMs,
  validateInt64,
  acknowledgeBatch,
  validateEventBusiness,
  sumMetrics,
  csvCell,
} from "../packages/contracts/telemetry.mjs";
test("跨午夜拆分并保留毫秒", () => {
  assert.deepEqual(
    splitDays("2026-11-12T15:59:50Z", "2026-11-12T16:00:10Z").map((x) => [
      x.day,
      x.end - x.start,
    ]),
    [
      ["2026-11-12", 10000],
      ["2026-11-13", 10000],
    ],
  );
});
test("两台电脑重叠活动取并集", () =>
  assert.equal(
    intervalMs([
      [0, 600000],
      [300000, 900000],
    ]),
    900000,
  ));
test("int64 不能丢精度或溢出", () => {
  assert.equal(validateInt64("9223372036854775807"), "9223372036854775807");
  assert.throws(() => validateInt64("9223372036854775808"));
  assert.throws(() => validateInt64("01"));
});
test("ACK 必须完整、无重复、无陌生 ID", () => {
  assert.deepEqual(
    acknowledgeBatch(["a", "b"], {
      accepted_event_ids: ["a"],
      duplicate_event_ids: ["b"],
      rejected_events: [],
    }).remove,
    ["a", "b"],
  );
  assert.throws(() =>
    acknowledgeBatch(["a", "b"], {
      accepted_event_ids: ["a"],
      duplicate_event_ids: ["a"],
      rejected_events: [],
    }),
  );
});
test("未知 Token 保持 null，部分已知可以累加", () => {
  assert.equal(
    sumMetrics([{ total_tokens: null }, { total_tokens: null }]).total_tokens,
    null,
  );
  assert.equal(
    sumMetrics([{ total_tokens: "9007199254740993" }, { total_tokens: "2" }])
      .total_tokens,
    "9007199254740995",
  );
});
test("拒绝重叠活动和非法缓存总量", () => {
  const e = {
    event_seq: "1",
    event_type: "desktop.activity",
    occurred_at: "2026-11-13T02:00:00Z",
    payload: {
      start_at: "2026-11-13T01:59:00Z",
      end_at: "2026-11-13T02:00:00Z",
      runtime_ms: "60000",
      time_quality: "synchronized",
      active_ranges: [
        { start_at: "2026-11-13T01:59:00Z", end_at: "2026-11-13T02:00:00Z" },
        { start_at: "2026-11-13T01:59:30Z", end_at: "2026-11-13T02:00:00Z" },
      ],
    },
  };
  assert.throws(() => validateEventBusiness(e, Date.parse(e.occurred_at)));
});
test("CSV 公式文本中和并正确转义", () => {
  assert.equal(csvCell("=1+1"), '"\'=1+1"');
  assert.equal(csvCell('a"b'), '"a""b"');
});
