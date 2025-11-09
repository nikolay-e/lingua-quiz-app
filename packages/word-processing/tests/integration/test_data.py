"""
Centralized test data for integration tests.

This module contains shared test cases that are reused across multiple test files,
following the DRY (Don't Repeat Yourself) principle.

All test data is organized by category and language for easy reuse.
"""

SPANISH_VERB_CONJUGATIONS = [
    ("estabas", "estar"),
    ("quieras", "querer"),
    ("hablado", "hablar"),
    ("viste", "ver"),
    ("comiendo", "comer"),
    ("tengo", "tener"),
    ("eres", "ser"),
    ("fuiste", "ir"),
    ("vayas", "ir"),
    ("estarás", "estar"),
    ("conocí", "conocer"),
]

SPANISH_PAST_PARTICIPLES = [
    ("hablado", "hablar"),
    ("llegado", "llegar"),
    ("tomado", "tomar"),
    ("ganado", "ganar"),
    ("olvidado", "olvidar"),
    ("preparado", "preparar"),
    ("pedido", "pedir"),
    ("unido", "unir"),
]

SPANISH_IMPERATIVES = [
    ("vete", "ir"),
    ("cállate", "callar"),
    ("quédate", "quedar"),
    ("espera", "esperar"),
    ("mira", "mirar"),
    ("ven", "venir"),
    ("di", "decir"),
]

SPANISH_ENCLITIC_PRONOUNS = [
    ("irme", "ir"),
    ("darme", "dar"),
    ("darte", "dar"),
    ("verme", "ver"),
    ("escucharme", "escuchar"),
]

SPANISH_FIRST_PERSON_PLURAL_IMPERATIVES = [
    ("vamos", "ir"),
    ("vámonos", "ir"),
]

SPANISH_NOUN_PLURALS = [
    ("gatos", "gato"),
    ("perros", "perro"),
    ("casas", "casa"),
    ("libros", "libro"),
]

SPANISH_ADJECTIVE_FORMS = [
    ("bonita", "bonito"),
    ("grandes", "grande"),
    ("rojas", "rojo"),
]

SPANISH_INTERROGATIVE_PRONOUNS = [
    ("cómo", "cómo"),
    ("como", "como"),
    ("dónde", "dónde"),
    ("donde", "donde"),
    ("quién", "quién"),
    ("quien", "quien"),
    ("qué", "qué"),
    ("que", "que"),
]

SPANISH_COMMON_ACCENTS = [
    ("está", "estar"),
    ("más", "más"),
    ("sólo", "sólo"),
    ("solo", "sólo"),
]

SPANISH_ALL_LEMMATIZATION_CASES = (
    SPANISH_VERB_CONJUGATIONS
    + SPANISH_PAST_PARTICIPLES
    + SPANISH_IMPERATIVES
    + SPANISH_ENCLITIC_PRONOUNS
    + SPANISH_FIRST_PERSON_PLURAL_IMPERATIVES
    + SPANISH_NOUN_PLURALS
    + SPANISH_ADJECTIVE_FORMS
)
