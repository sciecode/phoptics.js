/**
 * = opt_cache =
 * 
 * Reorganizes indices to improve vertex-cache locality.
 * 
 * Based on Arseny Kapoulkine's meshoptimizer - https://github.com/zeux/meshoptimizer
 * Copyright notice in 'meshoptimizer-license.md'
 * 
**/

import { Index } from 'phoptics';
import { TYPE } from "../common/type.mjs";
import { Memory } from '../common/memory.mjs';

const CACHE_SIZE = 16;
const EMPTY32 = 0xffff_ffff;
const WEIGHTS = {
  live: new Float32Array([0., 0.995, 0.713, 0.450, 0.404, 0.059, 0.005, 0.147, 0.006]),
  cache: new Float32Array([0., 0.779, 0.791, 0.789, 0.981, 0.843, 0.726, 0.847, 0.882, 0.867, 0.799, 0.642, 0.613, 0.600, 0.568, 0.372, 0.234])
}

const score = (pos, links) => WEIGHTS.cache[1 - pos] + WEIGHTS.live[links < 8 ? links : 8];

const opt_cache_group = (geometry, output) => {
  const indices = geometry.index.data;
  const index_count = indices.length;
  const triangle_count = index_count / 3;
  const attrib = geometry.attributes[0];
  const vertex_count = attrib.total_bytes / attrib.stride;

  const mem = {
    adj_count: { type: TYPE.u32, count: vertex_count },
    adj_offset: { type: TYPE.u32, count: vertex_count+1 },
    adj_data: { type: TYPE.u32, count: index_count },
    vertex_score: { type: TYPE.f32, count: vertex_count },
    triangle_score: { type: TYPE.f32, count: triangle_count },
    emitted: { type: TYPE.u8, count: triangle_count },
    cache: { type: TYPE.u32, count: 20 },
    cache_new: { type: TYPE.u32, count: 20 },
    cur: { type: TYPE.u32, count: 3 },
  }

  let { adj_count, adj_offset, adj_data,
    vertex_score, triangle_score, emitted, 
    cache, cache_new, cur } = Memory.allocate_layout(mem);
  
  for (let idx of indices) adj_count[idx]++;

  for (let i = 0, sum = 0; i < vertex_count; ++i) {
    adj_offset[i + 1] = sum;
    sum += adj_count[i];
  }

  for (let i = 0, il = triangle_count; i < il; ++i)
    for (let j = 0, i3 = i * 3; j < 3; ++j)
      adj_data[adj_offset[indices[i3 + j] + 1]++] = i;

  for (let i = 0; i < vertex_count; ++i)
    vertex_score[i] = score(-1, adj_count[i])

  for (let i = 0; i < triangle_count; ++i) {
    const i3 = i * 3;
    const a = vertex_score[indices[i3]];
    const b = vertex_score[indices[i3+1]];
    const c = vertex_score[indices[i3+2]];
    triangle_score[i] = a + b + c;
  }

  let cache_count = 0, current_triangle = 0;
  let output_triangle = 0, input_cursor = 1;
  
  while(current_triangle != EMPTY32) {

    let write_idx = 0;
    const ct3 = current_triangle * 3;
    const ot3 = output_triangle * 3;

    emitted[current_triangle] = 1;
    triangle_score[current_triangle] = 0;
    output_triangle++;

    // update current triangle info
    for (let k = 0; k < 3; ++k) {
      const index = cur[k] = indices[ct3+k];
      output[ot3+k] = index;
      cache_new[write_idx++] = index;
    }
    
    // update cache
    for (let i = 0; i < cache_count; ++i) {
      const index = cache[i];
      cache_new[write_idx] = index;
      write_idx += (index != cur[0]) & (index != cur[1]) & (index != cur[2]);
    }

    // swap caches
    let cache_temp = cache;
    cache = cache_new, cache_new = cache_temp;
    cache_count = write_idx > CACHE_SIZE ? CACHE_SIZE : write_idx;

    // update counts
    for (let k = 0; k < 3; ++k) {
      const index = cur[k];
      const offset = adj_offset[index];
      const size = adj_count[index];
      for (let i = 0; i < size; ++i) {
        if (adj_data[offset + i] == current_triangle) {
          adj_data[offset + i] = adj_data[offset+size-1]
          adj_count[index]--;
          break;
        }
      }
    }

    let best_triangle = EMPTY32;
    let best_score = 0;

    // update vertex & triangle scores
    for (let i = 0; i < write_idx; ++i) {
      const index = cache[i];

      if (!adj_count[index]) continue;

      const cache_position = i >= CACHE_SIZE ? -1 : i;

      const current_score = score(cache_position, adj_count[index]);
      const score_diff = current_score - vertex_score[index];
      vertex_score[index] = current_score;

      for (let i = adj_offset[index]; i < adj_count[index]; ++i) {
        const tri = adj_data[i];
        const tri_score = triangle_score[tri] + score_diff;
        triangle_score[tri] = tri_score;
        if (best_score < tri_score) { 
          best_triangle = tri;
          best_score = tri_score;
        }
      }
    }

    current_triangle = best_triangle;

    // search for next non-emitted triagle
    if (current_triangle == EMPTY32) {
      while (input_cursor < triangle_count) {
        if (!emitted[input_cursor]) {
          current_triangle = input_cursor;
          break;
        }
        ++input_cursor;
      }
    }

  }
}

export const opt_cache = (geometry) => {
  const indices = geometry.index.data;
  const output = new indices.constructor(indices.length + (indices.length & 1));
  opt_cache_group(geometry, output);
  geometry.index = new Index({
    data: output,
    stride: output.BYTES_PER_ELEMENT
  });
} 