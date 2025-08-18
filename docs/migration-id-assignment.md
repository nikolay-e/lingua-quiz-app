# Migration ID Assignment

## Language and Level Base Offsets

### German (Language Base: 3000000)
- German A1: 3000000

### Spanish (Language Base: 4000000)
- Spanish A1: 4000000

### English (Language Base: 8000000)
- English A1: 8000000
- English A2: 8010000
- English B1: 9000000
- English B2: 9005000

## ID Assignment Rules

### Translation IDs
Each vocabulary file uses a dedicated range:
- Start from the level base offset
- Increment by 1 for each entry
- Reserve 2000-5000 IDs per level to avoid conflicts

### Word IDs (Source and Target)
For each translation entry:
```
source_id = level_base_offset + sequence_number * 2 + 1
target_id = level_base_offset + sequence_number * 2 + 2
```

Where sequence_number starts at 0 and increments by 1 for each entry.
