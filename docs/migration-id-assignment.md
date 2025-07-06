# Migration ID Assignment

## Language Base Offsets
- German: 3000000
- Spanish: 4000000  
- English: 8000000

## ID Formula
```
word_pair_id = base_offset + sequence_number
source_id = base_offset + sequence_number * 2 + 1
target_id = base_offset + sequence_number * 2 + 2
```

Where sequence_number starts at 0 and increments by 1 for each entry.