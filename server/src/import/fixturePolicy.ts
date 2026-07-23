/**
 * 本地飞书样例和渲染快照只能服务显式 fixture 测试。
 * 真实公开链接导入（尤其 live corpus）绝不能把它们当成远程抓取成功。
 */
export function allowFeishuImportFixtures(): boolean {
  if (process.env.FEISHU_IMPORT_FIXTURE_MODE === '0') return false;
  if (process.env.FEISHU_IMPORT_FIXTURE_MODE === '1') return true;
  return process.env.NODE_ENV === 'test';
}
