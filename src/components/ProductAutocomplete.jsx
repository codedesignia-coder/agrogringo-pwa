import { useState, useEffect } from 'react';

/**
 * Componente de autocompletado para productos.
 * @param {object} props
 * @param {Array} props.products - La lista completa de productos disponibles.
 * @param {string} props.value - El valor actual del input.
 * @param {function} props.onChange - Función que se llama cuando el valor del input cambia.
 * @param {function} props.onSelect - Función que se llama cuando se selecciona una sugerencia (devuelve el objeto producto completo).
 */
export function ProductAutocomplete({ products, value, onChange, onSelect }) {
    const [inputValue, setInputValue] = useState(value || '');
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);

    useEffect(() => {
        setInputValue(value || '');
    }, [value]);

    const handleInputChange = (e) => {
        const query = e.target.value;
        setInputValue(query);
        onChange(query); // Mantenemos el formulario sincronizado mientras se escribe

        if (query.length > 1) {
            // Búsqueda más precisa: prioriza los que empiezan con la consulta
            const filteredSuggestions = products.filter(product =>
                product.nombre.toLowerCase().includes(query.toLowerCase())
            ).sort((a, b) =>
                a.nombre.toLowerCase().startsWith(query.toLowerCase()) ? -1 :
                    b.nombre.toLowerCase().startsWith(query.toLowerCase()) ? 1 : 0
            );
            setSuggestions(filteredSuggestions);
            setShowSuggestions(true);
        } else {
            setSuggestions([]);
            setShowSuggestions(false);
        }
    };

    const handleSelectSuggestion = (product) => {
        setInputValue(product.nombre);
        onChange(product.nombre); // Actualiza el valor del nombre en react-hook-form
        if (onSelect) onSelect(product); // Llama a la función onSelect con el objeto completo
        setSuggestions([]);
        setShowSuggestions(false);
    };

    return (
        <div className="relative">
            <input
                value={inputValue}
                onChange={handleInputChange}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)} // Pequeño delay para permitir el click
                onFocus={handleInputChange} // Vuelve a mostrar sugerencias si hay texto
                className="w-full p-2 border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500"
                placeholder="Buscar producto..."
                aria-label="Buscar producto"
                autoComplete="off"
            />
            {showSuggestions && (
                <ul className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-40 overflow-auto">
                    {suggestions.length > 0 ? (
                        suggestions.map((product) => (
                            <li
                                key={product.id}
                                onMouseDown={() => handleSelectSuggestion(product)} // Usamos onMouseDown para que se dispare antes del onBlur del input
                                className="px-4 py-2 cursor-pointer hover:bg-green-50"
                            >{product.nombre}</li>
                        ))
                    ) : (
                        <li className="px-4 py-2 text-sm text-gray-500">
                            {inputValue.length > 1 ? "No se encontraron productos" : "Escribe para buscar..."}
                        </li>
                    )}
                </ul>
            )}
        </div>
    );
}