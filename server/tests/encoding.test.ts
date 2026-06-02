import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeUploadedFilename } from '../src/encoding';

test('decodeUploadedFilename restores UTF-8 Chinese filenames from multer latin1', () => {
  const garbled = Buffer.from('测试文件.png', 'utf8').toString('latin1');
  assert.equal(decodeUploadedFilename(garbled), '测试文件.png');
  assert.equal(decodeUploadedFilename('readme.txt'), 'readme.txt');
});
