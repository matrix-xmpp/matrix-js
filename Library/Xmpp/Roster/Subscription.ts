/*
 * Copyright (C) Alexander Gnauck, AG-Software
 * Web: http://www.ag-software.de
 * Email: alex@ag-software.net * 
 */
module Matrix.Xmpp.Roster {
    export enum Subscription {
        /// <summary>
        /// the user does not have a subscription to the contact's presence information, 
        /// and the contact does not have a subscription to the user's presence information
        /// </summary>
        //[Name("none")]
        None,
        
        /// <summary>
        /// the user has a subscription to the contact's presence information, but the contact does 
        /// not have a subscription to the user's presence information
        /// </summary>
        //[Name("to")]
        To,
        
        /// <summary>
        /// the contact has a subscription to the user's presence information, but the user does not have a subscription 
        /// to the contact's presence information
        /// </summary>
        //[Name("from")]
        From,
        
        /// <summary>
        /// both the user and the contact have subscriptions to each other's presence information
        /// </summary>
        //[Name("both")]
        Both,
        
        /// <summary>
        /// for requests to remove the contact from the roster
        /// </summary>
        //[Name("remove")]
        Remove
    }
    Object.freeze(Subscription);
} 