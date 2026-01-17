import { useCallback } from 'react';
import { serverTimestamp, Timestamp } from 'firebase/firestore';

export default function useReceiptFormHandlers({
  user,
  toast,
  editingReceipt,
  editForm,
  formData,
  setEditForm,
  setFormData,
  setCurrentReceipt,
  setFormErrors,
  setIsBusy,
  setEditingReceipt,
  setIsEditing,
  setNewItem,
  setFile,
  setPreviewImageSrc,
  setCurrentStep,
  createReceipt,
  updateReceipt,
  fetchReceipts,
  onTabChange,
  normalizeDate,
  getFunnyMissingMessage,
  setSelectedCategory,
  setModalOpen,
  returnToCategory,
  setReturnToCategory,
  merchantInputRef,
}) {
  const resetFormData = useCallback(() => {
    setFormData({
      date: new Date().toISOString().split('T')[0],
      merchant: '',
      total: '',
      tax: '',
      subtotal: '',
      paymentMethod: '',
      currency: 'EUR',
      items: [],
      category: '',
    });
  }, [setFormData]);

  const handleManualEntry = useCallback(() => {
    resetFormData();
    setCurrentStep('manual_entry');
    setTimeout(() => {
      merchantInputRef.current?.focus();
    }, 100);
  }, [merchantInputRef, resetFormData, setCurrentStep]);

  const handleFormInputChange = useCallback((e) => {
    const { name, value } = e.target;
    const targetStateSetter = editingReceipt ? setEditForm : setFormData;

    targetStateSetter(prev => {
      let updatedData = { ...prev };
      if (name === "total" || name === "subtotal" || name === "tax") {
        if (value === '' || /^-?[0-9]*\.?[0-9]{0,2}$/.test(value.replace(',', '.'))) {
          updatedData[name] = value.replace(',', '.');
        }
      } else if (name === "date") {
        updatedData[name] = normalizeDate(value);
      } else {
        updatedData[name] = value;
      }
      return updatedData;
    });

    if (editingReceipt) {
      setCurrentReceipt(prev => {
        let updatedReceipt = { ...prev };
        updatedReceipt[name] = (name === "total" || name === "subtotal" || name === "tax")
          ? (value === '' ? '' : parseFloat(value.replace(',', '.')))
          : value;
        return updatedReceipt;
      });
    }
  }, [editingReceipt, normalizeDate, setCurrentReceipt, setEditForm, setFormData]);

  const handleItemInputChange = useCallback((e, index, field) => {
    const { value } = e.target;
    const targetStateSetter = editingReceipt ? setEditForm : setFormData;

    targetStateSetter(prev => {
      const updatedItems = [...(prev.items || [])];
      updatedItems[index] = {
        ...updatedItems[index],
        [field]: (field === 'price') ? (value === '' ? '' : parseFloat(value.replace(',', '.')).toFixed(2)) : value
      };
      return { ...prev, items: updatedItems };
    });

    if (editingReceipt) {
      setCurrentReceipt(prev => {
        const updatedItems = [...(prev.items || [])];
        updatedItems[index] = {
          ...updatedItems[index],
          [field]: (field === 'price') ? (value === '' ? '' : parseFloat(value.replace(',', '.')).toFixed(2)) : value
        };
        return { ...prev, items: updatedItems };
      });
    }
  }, [editingReceipt, setCurrentReceipt, setEditForm, setFormData]);

  const handleAddItemField = useCallback((insertIndex) => {
    const targetStateSetter = editingReceipt ? setEditForm : setFormData;
    targetStateSetter(prevData => {
      const newItems = [...(prevData.items || [])];
      const newItem = { name: '', price: '' };
      if (insertIndex !== undefined && insertIndex !== null) {
        newItems.splice(insertIndex + 1, 0, newItem);
      } else {
        newItems.push(newItem);
      }
      return { ...prevData, items: newItems };
    });
    if (editingReceipt) {
      setCurrentReceipt(prev => {
        const newItems = [...(prev.items || [])];
        const newItem = { name: '', price: '' };
        if (insertIndex !== undefined && insertIndex !== null) {
          newItems.splice(insertIndex + 1, 0, newItem);
        } else {
          newItems.push(newItem);
        }
        return { ...prev, items: newItems };
      });
    }
  }, [editingReceipt, setCurrentReceipt, setEditForm, setFormData]);

  const handleRemoveItemField = useCallback((removeIndex) => {
    const targetStateSetter = editingReceipt ? setEditForm : setFormData;
    targetStateSetter(prevData => {
      if ((prevData.items || []).length === 1 && (!prevData.items[0].name && !prevData.items[0].price)) {
        return prevData;
      }
      if ((prevData.items || []).length > 0) {
        const newItems = (prevData.items || []).filter((_, i) => i !== removeIndex);
        return { ...prevData, items: newItems };
      }
      return prevData;
    });
    if (editingReceipt) {
      setCurrentReceipt(prev => {
        if ((prev.items || []).length === 1 && (!prev.items[0].name && !prev.items[0].price)) {
          return prev;
        }
        if ((prev.items || []).length > 0) {
          const newItems = (prev.items || []).filter((_, i) => i !== removeIndex);
          return { ...prev, items: newItems };
        }
        return prev;
      });
    }
  }, [editingReceipt, setCurrentReceipt, setEditForm, setFormData]);

  const handleSaveReceiptSubmit = useCallback(async () => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to save receipts.",
        variant: "destructive",
      });
      return;
    }

    setIsBusy(true);
    setFormErrors({});

    const activeForm = editingReceipt ? editForm : formData;

    const missingFields = [];
    if (!activeForm.merchant) missingFields.push('merchant');
    if (!activeForm.total) missingFields.push('total');
    if (!activeForm.date) missingFields.push('date');
    if (!editingReceipt && (!activeForm.items || activeForm.items.length === 0)) {
      missingFields.push('items');
    }

    if (missingFields.length > 0) {
      setFormErrors({
        merchant: !activeForm.merchant ? 'Merchant is required.' : '',
        date: !activeForm.date ? 'Date is required.' : '',
        total: !activeForm.total ? 'Total amount is required.' : '',
        items: !activeForm.items || activeForm.items.length === 0 ? 'At least one item is required.' : ''
      });
      toast({
        title: "Missing Information",
        description: getFunnyMissingMessage(missingFields),
        variant: "destructive",
      });
      setIsBusy(false);
      return;
    }

    let cleanedItems = (activeForm.items || [])
      .filter(item => item.name && !isNaN(parseFloat(item.price)) && item.price !== '')
      .map(item => ({
        name: item.name,
        price: parseFloat(item.price),
      }));

    if (cleanedItems.length === 0 && editingReceipt?.items?.length) {
      cleanedItems = editingReceipt.items.map(item => ({
        name: item.name || '',
        price: parseFloat(item.price) || 0,
      }));
    }

    if (!editingReceipt && cleanedItems.length === 0) {
      setFormErrors({
        items: 'Please ensure all items have a name and a valid price.'
      });
      toast({
        title: "Invalid Items",
        description: "Please ensure all items have a name and a valid price.",
        variant: "destructive",
      });
      setIsBusy(false);
      return;
    }

    let calculatedTax = parseFloat(activeForm.tax) || 0;
    if ((!activeForm.tax || calculatedTax === 0) && activeForm.total && activeForm.subtotal) {
      const total = parseFloat(activeForm.total);
      const subtotal = parseFloat(activeForm.subtotal);
      if (!isNaN(total) && !isNaN(subtotal) && total > subtotal) {
        calculatedTax = total - subtotal;
      }
    }
    if (calculatedTax < 0) calculatedTax = 0;

    let transactionDateValue;
    if (activeForm.date) {
      const dateObj = (activeForm.date instanceof Date)
        ? activeForm.date
        : new Date(activeForm.date);
      transactionDateValue = Timestamp.fromDate(dateObj);
    } else {
      transactionDateValue = serverTimestamp();
    }

    const receiptData = {
      userId: user.uid,
      merchant: activeForm.merchant,
      date: serverTimestamp(),
      transactionDate: transactionDateValue,
      total: parseFloat(activeForm.total),
      subtotal: parseFloat(activeForm.subtotal),
      tax: calculatedTax,
      paymentMethod: activeForm.paymentMethod || 'Other',
      currency: activeForm.currency,
      items: cleanedItems,
      imageUrl: activeForm.imageUrl || '',
      category: activeForm.category || 'Uncategorized',
      createdAt: serverTimestamp(),
    };

    try {
      if (editingReceipt) {
        await updateReceipt(editingReceipt.id, receiptData);
        toast({
          title: "Receipt Updated",
          description: "Your receipt has been successfully updated.",
        });
      } else {
        await createReceipt(receiptData);
        toast({
          title: "Saved",
          description: "Saved. Ready for export.",
        });
      }

      setFormData({
        date: new Date().toISOString().split('T')[0],
        merchant: '',
        total: '',
        tax: '',
        subtotal: '',
        paymentMethod: '',
        currency: 'EUR',
        items: [],
        category: '',
      });
      setNewItem({ name: '', price: '' });
      setEditingReceipt(null);
      setIsEditing(false);
      setFile(null);
      setPreviewImageSrc(null);
      setCurrentStep('upload_options');
      await fetchReceipts();

      if (onTabChange) {
        if (editingReceipt?.groupId) onTabChange('group'); else onTabChange('expenses');
      }
    } catch (error) {
      console.error("Error saving receipt:", error);
      toast({
        title: editingReceipt ? "Error Updating Receipt" : "Error Saving Receipt",
        description: `There was an issue saving your receipt: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsBusy(false);
    }
  }, [
    createReceipt,
    editForm,
    editingReceipt,
    fetchReceipts,
    formData,
    getFunnyMissingMessage,
    onTabChange,
    setEditingReceipt,
    setFormData,
    setFormErrors,
    setIsBusy,
    setIsEditing,
    setNewItem,
    setCurrentStep,
    setFile,
    setPreviewImageSrc,
    toast,
    updateReceipt,
    user,
  ]);

  const handleCloseReceiptForm = useCallback(() => {
    if (returnToCategory) {
      setSelectedCategory(returnToCategory);
      setModalOpen(true);
      setReturnToCategory(null);
    } else {
      setCurrentStep('upload_options');
    }
    setEditingReceipt(null);
    setIsEditing(false);
    resetFormData();
    setFile(null);
    setPreviewImageSrc(null);
  }, [
    resetFormData,
    returnToCategory,
    setCurrentStep,
    setEditingReceipt,
    setFile,
    setIsEditing,
    setModalOpen,
    setPreviewImageSrc,
    setReturnToCategory,
    setSelectedCategory,
  ]);

  return {
    resetFormData,
    handleManualEntry,
    handleFormInputChange,
    handleItemInputChange,
    handleAddItemField,
    handleRemoveItemField,
    handleSaveReceiptSubmit,
    handleCloseReceiptForm,
  };
}
