def snake_to_camel(snake_str):
    components = snake_str.split("_")
    return components[0] + "".join(x.title() for x in components[1:])


def convert_keys_to_camel_case(obj):
    if isinstance(obj, list):
        return [convert_keys_to_camel_case(item) for item in obj]
    if isinstance(obj, dict):
        return {snake_to_camel(k): convert_keys_to_camel_case(v) for k, v in obj.items()}
    return obj
