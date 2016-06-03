/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net * 
 */
interface IEvent<T> {
    on(handler: { (data?: T): void });
    off(handler: { (data?: T): void });
} 