#!/usr/bin/env python3

import argparse
import json
from pathlib import Path
import sys

BASIC_TRANSLATIONS = {
    "el": "определённый артикль (мужской род)",
    "la": "определённый артикль (женский род)",
    "los": "определённый артикль (мужской род множественное число)",
    "las": "определённый артикль (женский род множественное число)",
    "un": "неопределённый артикль (мужской род)",
    "una": "неопределённый артикль (женский род)",
    "en": "в, на",
    "de": "из, от, о",
    "del": "из (de + el)",
    "al": "к, в (a + el)",
    "a": "к, в, на",
    "con": "с",
    "para": "для, чтобы",
    "por": "по, за, из-за",
    "y": "и",
    "o": "или",
    "pero": "но",
    "si": "если, да",
    "que": "что, который",
    "como": "как",
    "no": "нет, не",
    "ni": "ни",
    "yo": "я",
    "tú": "ты",
    "tu": "твой, твоя",
    "él": "он",
    "ella": "она",
    "nosotros": "мы",
    "vosotros": "вы (неформальное)",
    "ellos": "они (мужской род)",
    "ellas": "они (женский род)",
    "usted": "Вы (формальное)",
    "ustedes": "вы (формальное множественное число)",
    "ya": "уже, уже да",
    "solo": "только, один",
    "sólo": "только",
    "más": "более, больше",
    "mas": "но (устаревшее)",
    "muy": "очень",
    "bien": "хорошо",
    "mal": "плохо",
    "así": "так, таким образом",
    "asi": "так, таким образом",
    "también": "также, тоже",
    "tambien": "также, тоже",
    "tampoco": "также не, тоже не",
    "ser": "быть (постоянное состояние)",
    "estar": "быть (временное состояние)",
    "tener": "иметь",
    "hacer": "делать",
    "ir": "идти",
    "poder": "мочь",
    "decir": "говорить",
    "dar": "давать",
    "ver": "видеть",
    "saber": "знать",
    "querer": "хотеть",
    "llegar": "прибывать",
    "poner": "класть, ставить",
    "parecer": "казаться",
    "dejar": "оставлять, позволять",
    "seguir": "следовать, продолжать",
    "encontrar": "находить",
    "llamar": "звонить, называть",
    "venir": "приходить",
    "pensar": "думать",
    "salir": "выходить",
    "volver": "возвращаться",
    "tomar": "брать, пить",
    "conocer": "знать (быть знакомым)",
    "vivir": "жить",
    "sentir": "чувствовать",
    "tratar": "пробовать, обращаться",
    "mirar": "смотреть",
    "contar": "считать, рассказывать",
    "empezar": "начинать",
    "esperar": "ждать, надеяться",
    "buscar": "искать",
    "existir": "существовать",
    "entrar": "входить",
    "trabajar": "работать",
    "escribir": "писать",
    "perder": "терять",
    "producir": "производить",
    "ocurrir": "происходить",
    "entender": "понимать",
    "pedir": "просить",
    "recibir": "получать",
    "recordar": "помнить",
    "terminar": "заканчивать",
    "permitir": "позволять",
    "aparecer": "появляться",
    "conseguir": "получать, добиваться",
    "comenzar": "начинать",
    "servir": "служить",
    "sacar": "вытаскивать, получать",
    "necesitar": "нуждаться",
    "mantener": "поддерживать, содержать",
    "resultar": "получаться, оказываться",
    "leer": "читать",
    "caer": "падать",
    "cambiar": "менять",
    "presentar": "представлять",
    "crear": "создавать",
    "abrir": "открывать",
    "considerar": "рассматривать",
    "oír": "слышать",
    "acabar": "заканчивать",
    "suponer": "предполагать",
    "lograr": "достигать",
    "explicar": "объяснять",
    "reconocer": "признавать, узнавать",
    "estudiar": "изучать",
    "intentar": "пытаться",
    "ganar": "выигрывать, зарабатывать",
    "realizar": "осуществлять, выполнять",
    "correr": "бежать",
    "utilizar": "использовать",
    "pagar": "платить",
    "ayudar": "помогать",
    "gustar": "нравиться",
    "jugar": "играть",
    "escuchar": "слушать",
    "cumplir": "выполнять, исполняться",
    "ofrecer": "предлагать",
    "descubrir": "обнаруживать",
    "levantar": "поднимать",
    "nacer": "рождаться",
    "momento": "момент",
    "tiempo": "время",
    "año": "год",
    "día": "день",
    "hora": "час",
    "vez": "раз",
    "caso": "случай",
    "parte": "часть",
    "forma": "форма, способ",
    "cosa": "вещь",
    "mundo": "мир",
    "hombre": "мужчина, человек",
    "mujer": "женщина",
    "vida": "жизнь",
    "lugar": "место",
    "punto": "точка, пункт",
    "tema": "тема",
    "problema": "проблема",
    "palabra": "слово",
    "nombre": "имя",
    "ciudad": "город",
    "país": "страна",
    "grupo": "группа",
    "empresa": "компания",
    "ejemplo": "пример",
    "fin": "конец",
    "orden": "порядок",
    "razón": "причина, разум",
    "pregunta": "вопрос",
    "respuesta": "ответ",
    "idea": "идея",
    "número": "число, номер",
    "mes": "месяц",
    "semana": "неделя",
    "mano": "рука (кисть)",
    "casa": "дом",
    "calle": "улица",
    "puerta": "дверь",
    "ventana": "окно",
    "mesa": "стол",
    "silla": "стул",
    "libro": "книга",
    "papel": "бумага",
    "agua": "вода",
    "comida": "еда",
    "coche": "машина",
    "grande": "большой",
    "pequeño": "маленький",
    "bueno": "хороший",
    "malo": "плохой",
    "nuevo": "новый",
    "viejo": "старый",
    "primero": "первый",
    "último": "последний",
    "mismo": "тот же самый",
    "otro": "другой",
    "todo": "весь, всё",
    "cada": "каждый",
    "poco": "мало",
    "mucho": "много",
    "importante": "важный",
    "mejor": "лучший",
    "peor": "худший",
    "mayor": "старший, больший",
    "menor": "младший, меньший",
    "claro": "ясный, светлый",
    "posible": "возможный",
    "imposible": "невозможный",
    "probable": "вероятный",
    "difícil": "трудный",
    "fácil": "лёгкий",
    "largo": "длинный",
    "corto": "короткий",
    "alto": "высокий",
    "bajo": "низкий",
    "abierto": "открытый",
    "cerrado": "закрытый",
    "embargo": "однако (sin embargo - тем не менее)",
    "pues": "ну, итак",
    "mediante": "посредством",
    "varios": "несколько",
    "oficial": "официальный",
    "sur": "юг",
    "autor": "автор",
    "corte": "суд, разрез",
    "comisión": "комиссия",
    "encuentro": "встреча",
    "profesor": "преподаватель",
    "formación": "образование, формирование",
    "premio": "приз, награда",
    "re": "ре (нота), король (в карточных играх)",
    "cultural": "культурный",
    "revolución": "революция",
    "alma": "душа",
    "conocimiento": "знание",
    "tecnología": "технология",
    "curso": "курс",
    "democracia": "демократия",
    "fe": "вера",
    "género": "род, жанр",
    "posibilidad": "возможность",
    "profesional": "профессиональный",
}


def load_missing_words(json_path: Path, top_n: int = 50) -> list[dict]:
    with open(json_path, encoding="utf-8") as f:
        data = json.load(f)

    missing_words = [
        {
            "lemma": item["lemma"],
            "rank": item["rank_estimate"],
            "zipf": item["zipf"],
        }
        for item in data[:top_n]
    ]

    return missing_words


def get_translation(spanish_word: str) -> str:
    if spanish_word in BASIC_TRANSLATIONS:
        return BASIC_TRANSLATIONS[spanish_word]

    return f"[перевод для '{spanish_word}']"


def fill_placeholders(migration_file: Path, missing_words_json: Path, output_file: Path = None):
    with open(migration_file, encoding="utf-8") as f:
        data = json.load(f)

    placeholders = [(i, pair) for i, pair in enumerate(data["word_pairs"]) if pair["source_word"] == "[PLACEHOLDER]"]

    print(f"Найдено placeholders: {len(placeholders)}")

    missing_words = load_missing_words(missing_words_json, top_n=len(placeholders))

    print(f" Загружено недостающих слов: {len(missing_words)}")
    print(f" Заполняем {min(len(placeholders), len(missing_words))} записей...")
    print()

    filled_count = 0
    for (idx, placeholder), missing in zip(placeholders, missing_words, strict=False):
        spanish_word = missing["lemma"]
        russian_translation = get_translation(spanish_word)

        data["word_pairs"][idx]["source_word"] = spanish_word
        data["word_pairs"][idx]["target_word"] = russian_translation

        print(f"✓ ID {placeholder['translation_id']}: {spanish_word} → {russian_translation} (ранг {missing['rank']:,})")
        filled_count += 1

    if output_file is None:
        output_file = migration_file

    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print()
    print(f"Заполнено {filled_count} записей")
    print(f" Сохранено в: {output_file}")

    return filled_count


def main():
    parser = argparse.ArgumentParser(description="Fill placeholder entries in migration files with missing words")
    parser.add_argument(
        "--migration-file",
        "-m",
        required=True,
        help="Path to migration JSON file with placeholders",
    )
    parser.add_argument(
        "--missing-words",
        "-w",
        required=True,
        help="Path to JSON file with missing words analysis",
    )
    parser.add_argument(
        "--output",
        "-o",
        help="Output file path (default: overwrite input file)",
    )

    args = parser.parse_args()

    migration_file = Path(args.migration_file)
    missing_words_json = Path(args.missing_words)
    output_file = Path(args.output) if args.output else None

    if not migration_file.exists():
        print(f"Migration file not found: {migration_file}")
        return 1

    if not missing_words_json.exists():
        print(f"Missing words JSON not found: {missing_words_json}")
        return 1

    fill_placeholders(migration_file, missing_words_json, output_file)

    return 0


if __name__ == "__main__":
    sys.exit(main())
