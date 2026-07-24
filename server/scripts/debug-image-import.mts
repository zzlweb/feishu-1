import 'dotenv/config';

async function main() {
  const url = process.argv[2] || 'https://qcntpn5n60jv.feishu.cn/wiki/BARQwFd6yi1CGzkTJNBcNHIbn8b';
  console.log('APP_ID', Boolean(process.env.FEISHU_APP_ID));
  console.log('SECRET', Boolean(process.env.FEISHU_APP_SECRET));
  console.log('BASE', process.env.FEISHU_OPEN_API_BASE_URL || '');

  const { getFeishuApiConfigFromEnv, createFeishuApiClient, parseFeishuUrl } = await import('../src/import/feishuApiClient.ts');
  const { fetchFeishuRawDocumentData } = await import('../src/import/feishuRawDocumentFetcher.ts');
  const config = getFeishuApiConfigFromEnv();
  if (!config) {
    console.error('NO_CONFIG');
    process.exit(1);
  }
  const client = createFeishuApiClient(config);
  const raw = await fetchFeishuRawDocumentData(url, { config, client, downloadMedia: false });
  const blocks = (raw.document?.blocks || []) as Array<Record<string, unknown>>;
  const imageBlocks = blocks.filter(block => block.block_type === 27 || Boolean(block.image));
  const gridBlocks = blocks.filter(block => block.block_type === 24 || Boolean(block.grid));
  const columnBlocks = blocks.filter(block => block.block_type === 25 || Boolean(block.grid_column));
  console.log(JSON.stringify({
    title: raw.target?.title,
    blockCount: blocks.length,
    mediaRefs: raw.mediaRefs?.length,
    imageBlocks: imageBlocks.map(block => ({
      id: block.block_id,
      parent: block.parent_id,
      type: block.block_type,
      image: block.image,
      children: block.children,
    })),
    gridBlocks: gridBlocks.map(block => ({
      id: block.block_id,
      parent: block.parent_id,
      type: block.block_type,
      grid: block.grid,
      children: block.children,
    })),
    columnBlocks: columnBlocks.map(block => ({
      id: block.block_id,
      parent: block.parent_id,
      type: block.block_type,
      grid_column: block.grid_column,
      children: block.children,
    })),
    allTypes: Array.from(new Set(blocks.map(block => String(block.block_type)))).sort(),
  }, null, 2));
}

main().catch(error => {
  console.error('FAILED', error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});
